import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { Buffer } from 'buffer';
import * as process from 'process';

(window as any).process = process;

(window as any).Buffer = Buffer;


bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
