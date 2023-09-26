import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TemperatureDocument = HydratedDocument<Temperature>;

@Schema()
export class Temperature {
  @Prop()
  deviceId: string;

  @Prop()
  temperature: number;

  @Prop()
  timeStamp: number;
}

export const TemperatureSchema = SchemaFactory.createForClass(Temperature);
