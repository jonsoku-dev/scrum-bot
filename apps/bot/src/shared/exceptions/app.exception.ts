import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly errorCode?: string,
  ) {
    super({ message, errorCode }, status);
  }
}
