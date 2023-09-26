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
    const BATCH_SIZE = 1000;
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
    const time2016 = Math.floor(new Date(startAt).getTime() / 1000) * 1000;

    const oneYearAgoOfTime2016 = time2016 - 365 * 24 * 60 * 60 * 1000;

    console.log(time2016, oneYearAgoOfTime2016);

    // Calculate the moving averages for each interval
    const aggregationPipeline = [
      {
        $match: {
          timeStamp: {
            $gte: oneYearAgoOfTime2016,
            $lte: time2016,
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

    const result = await this.TemperatureModel.aggregate(aggregationPipeline);

    return result;
  }
}
