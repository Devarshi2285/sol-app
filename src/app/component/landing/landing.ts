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
    private heroSection!: HTMLElement | null;
    private heroMouseMove!: (e: MouseEvent) => void;
    private heroMouseLeave!: () => void;
    private heroResizeUpdate!: () => void;
    private tiltRafId = 0;

    ngAfterViewInit() {
        // Scroll-reveal observer
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

        // 3D tilt on hero visual — mouse moves over the hero section tilt the card
        const mediaWrapper = document.querySelector('.hero-media-wrapper') as HTMLElement;
        this.heroSection = document.querySelector('.hero') as HTMLElement;

        if (mediaWrapper && this.heroSection) {
            // Cache rect; refresh on resize to avoid recalculating on every mousemove
            let rect = mediaWrapper.getBoundingClientRect();
            this.heroResizeUpdate = () => { rect = mediaWrapper.getBoundingClientRect(); };
            window.addEventListener('resize', this.heroResizeUpdate, { passive: true });

            this.heroMouseMove = (e: MouseEvent) => {
                cancelAnimationFrame(this.tiltRafId);
                this.tiltRafId = requestAnimationFrame(() => {
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dx = (e.clientX - cx) / (rect.width / 2);
                    const dy = (e.clientY - cy) / (rect.height / 2);
                    mediaWrapper.style.transform =
                        `perspective(1200px) rotateY(${dx * 8}deg) rotateX(${-dy * 6}deg)`;
                });
            };

            this.heroMouseLeave = () => {
                cancelAnimationFrame(this.tiltRafId);
                mediaWrapper.style.transform =
                    'perspective(1200px) rotateY(0deg) rotateX(0deg)';
            };

            this.heroSection.addEventListener('mousemove', this.heroMouseMove);
            this.heroSection.addEventListener('mouseleave', this.heroMouseLeave);
        }
    }

    ngOnDestroy() {
        cancelAnimationFrame(this.tiltRafId);
        this.observer?.disconnect();
        if (this.heroSection) {
            this.heroSection.removeEventListener('mousemove', this.heroMouseMove);
            this.heroSection.removeEventListener('mouseleave', this.heroMouseLeave);
        }
        if (this.heroResizeUpdate) {
            window.removeEventListener('resize', this.heroResizeUpdate);
        }
    }
}
