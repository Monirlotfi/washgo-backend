import { Global, Module } from '@nestjs/common';
import { InfobipService } from './infobip.service';

@Global()
@Module({
  providers: [InfobipService],
  exports: [InfobipService],
})
export class InfobipModule {}
