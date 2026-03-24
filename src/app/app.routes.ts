import { Routes } from '@angular/router';
import { AddProfile } from './component/add-profile/add-profile';
import { CreateDoc } from './component/create-doc/create-doc';
import { SignDoc } from './component/sign-doc/sign-doc';

export const routes: Routes = [
    { path: '', redirectTo: 'profile', pathMatch: 'full' },
    { path: 'profile', component: AddProfile },
    { path: 'create-doc', component: CreateDoc },
    { path: 'sign-doc', component: SignDoc },
];
