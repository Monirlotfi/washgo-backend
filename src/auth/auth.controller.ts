import {
  Body, Controller, Get, HttpCode, HttpStatus, Post,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterWasherDto } from './dto/register-washer.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/client')
  @HttpCode(HttpStatus.CREATED)
  registerClient(@Body() dto: RegisterClientDto) {
    return this.authService.registerClient(dto);
  }

  @Post('register/washer')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('cinPhoto'))
  registerWasher(
    @Body() dto: RegisterWasherDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registerWasher(dto, file?.buffer);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user;
  }
}