import { Global, Module } from '@nestjs/common';
import { StatusMachineService } from './status-machine.service';

@Global()
@Module({
  providers: [StatusMachineService],
  exports: [StatusMachineService],
})
export class StatusMachineModule {}
