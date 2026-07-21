import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class CarouselGateway {
  @WebSocketServer()
  server: Server;

  emitCarouselUpdate() {
    this.server.emit('carousel.updated');
  }
}
