import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AppService } from '../../app-service';

@Component({
    selector: 'app-add-profile',
    imports: [FormsModule, CommonModule],
    templateUrl: './add-profile.html',
    styleUrl: './add-profile.css',
})
export class AddProfile {

    private appService = inject(AppService);

    username = '';
    password = '';
    isLoading = false;
    checking = signal(true);
    profile: WritableSignal<any> = signal(null);

    async ngOnInit() {
        await this.appService.connectWallat();
        this.checking.set(true);
        try {
            const pda = this.appService.generatePDA('PROFILE');
            const result = await this.appService.queryProfile(pda);
            if (result) {
                this.profile.set(result);
            }
        } catch (err) {
            console.error(err);
        } finally {
            this.checking.set(false);
        }
    }

    async register() {
        if (!this.username || !this.password) return;
        this.isLoading = true;
        try {
            await this.appService.register(this.username, this.password);
            // Re-query to show profile after creation
            const pda = this.appService.generatePDA('PROFILE');
            const result = await this.appService.queryProfile(pda);
            if (result) {
                this.profile.set(result);
            }
        } catch (err) {
            console.error(err);
        } finally {
            this.isLoading = false;
        }
    }
}
