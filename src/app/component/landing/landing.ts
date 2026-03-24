import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-landing',
    imports: [RouterLink],
    templateUrl: './landing.html',
    styleUrl: './landing.css',
})
export class Landing implements AfterViewInit, OnDestroy {

    private observer!: IntersectionObserver;

    ngAfterViewInit() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        this.observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );

        document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach((el) => {
            this.observer.observe(el);
        });
    }

    ngOnDestroy() {
        this.observer?.disconnect();
    }
}
