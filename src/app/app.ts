import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppService } from './app-service';
import { Header } from './component/header/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  private appService = inject(AppService);

  async ngOnInit() {
    await this.appService.connectWallat();
  }
}
