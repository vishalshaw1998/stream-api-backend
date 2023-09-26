import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { streamArray } from 'stream-json/streamers/StreamArray';
import * as multer from 'multer';
import { parser } from 'stream-json';
import { InjectModel } from '@nestjs/mongoose';
import { Temperature } from './schemas/temperature.schema';
import { Model } from 'mongoose';
import { BATCH_SIZE } from './constants/insert-batch-size';

@Controller()
export class AppController {
  constructor(
    @InjectModel(Temperature.name) private TemperatureModel: Model<Temperature>,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({}),
    }),
  )
  async upload(@UploadedFile() file, @Body() body: { deviceId: string }) {
    let batch = [];
    const stream = createReadStream('/tmp/' + file.filename, {
      encoding: 'utf8',
      highWaterMark: 16 * 1024,
    });

    const jsonStream = stream.pipe(parser()).pipe(streamArray());

    jsonStream.on('data', async ({ value }) => {
      jsonStream.pause();

      batch.push({
        deviceId: body.deviceId,
        timeStamp: value.ts,
        temperature: value.val,
      });

      if (batch.length >= BATCH_SIZE) {
        await this.TemperatureModel.insertMany(batch);
        batch = [];
      }

      jsonStream.resume();
    });

    jsonStream.on('end', () => {
      console.log('JSON processing completed.');
      stream.close();
    });
  }

  @Get('temperatures')
  async getTemperatures(@Query('startAt') startAt: any) {
    const startTime = Math.floor(new Date(startAt).getTime() / 1000) * 1000;

    const endTime = startTime + 365 * 24 * 60 * 60 * 1000;

    // Calculate the moving averages for each interval
    const aggregationPipeline = [
      {
        $match: {
          timeStamp: {
            $gte: startTime,
            $lte: endTime,
          },
        },
      },
      {
        $project: {
          monthYear: {
            $dateToString: {
              format: '%Y-%m',
              date: {
                $toDate: '$timeStamp',
              },
            },
          },
          val: '$temperature',
        },
      },
      {
        $group: {
          _id: '$monthYear',
          avgTemp: {
            $avg: '$val',
          },
        },
      },
      {
        $sort: {
          _id: 1,
        } as any,
      },
    ];

    return this.TemperatureModel.aggregate(aggregationPipeline);
  }
}
