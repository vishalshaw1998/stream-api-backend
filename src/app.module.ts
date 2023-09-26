import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TemperatureSchema } from './schemas/temperature.schema';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/MyDb'),
    MongooseModule.forFeature([
      { name: 'Temperature', schema: TemperatureSchema },
    ]),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
