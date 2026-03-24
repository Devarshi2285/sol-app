import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AppService } from './app-service';
import { Header } from './component/header/header';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  private appService = inject(AppService);
  private router = inject(Router);
  isLanding = true;

  async ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.isLanding = event.urlAfterRedirects === '/' || event.url === '/';
      });

    // Check initial route
    this.isLanding = this.router.url === '/';

    await this.appService.connectWallat();
  }
}
