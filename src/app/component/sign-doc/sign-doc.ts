import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AppService } from '../../app-service';

interface EnrichedDoc {
    pda: string;
    docLink: string;
    creatorName: string;
    contributors: string[];
    signedBy: string[];
    logs: string[];
    isFinal: boolean;
    alreadySigned: boolean;
    signing: boolean;
    logsExpanded: boolean;
}

@Component({
    selector: 'app-sign-doc',
    imports: [FormsModule, CommonModule],
    templateUrl: './sign-doc.html',
    styleUrl: './sign-doc.css',
})
export class SignDoc {

    private appService = inject(AppService);

    loadingDocs = signal(true);
    myDocs: WritableSignal<EnrichedDoc[]> = signal([]);
    error: WritableSignal<string | null> = signal(null);

    async ngOnInit() {
        await this.appService.connectWallat();
        await this.loadMyDocs();
    }

    async loadMyDocs() {
        this.loadingDocs.set(true);
        try {
            const index = await this.appService.queryContributorIndex();
            if (!index || !index.docs.length) {
                this.myDocs.set([]);
                return;
            }

            const myWallet = this.appService.wallat.publicKey.toBase58();
            const enriched: EnrichedDoc[] = [];

            for (const docPda of index.docs) {
                const doc = await this.appService.queryDoc(docPda);
                if (!doc) continue;

                // Resolve creator name
                let creatorName = doc.creator;
                try {
                    const [profilePDA] = await this.deriveProfilePDA(doc.creator);
                    const profile = await this.appService.queryProfile(profilePDA);
                    creatorName = profile?.name || doc.creator.slice(0, 6) + '…' + doc.creator.slice(-4);
                } catch {
                    creatorName = doc.creator.slice(0, 6) + '…' + doc.creator.slice(-4);
                }

                // Resolve contributor names
                const contriNames: string[] = [];
                for (const c of doc.contributers) {
                    const addr = c.toBase58 ? c.toBase58() : c.toString();
                    try {
                        const [profilePDA] = await this.deriveProfilePDA(addr);
                        const profile = await this.appService.queryProfile(profilePDA);
                        contriNames.push(profile?.name || addr.slice(0, 6) + '…' + addr.slice(-4));
                    } catch {
                        contriNames.push(addr.slice(0, 6) + '…' + addr.slice(-4));
                    }
                }

                // Resolve signed-by names & check if I signed
                const signedNames: string[] = [];
                let alreadySigned = false;
                for (const s of doc.signedBy) {
                    const addr = s.toBase58 ? s.toBase58() : s.toString();
                    if (addr === myWallet) alreadySigned = true;
                    try {
                        const [profilePDA] = await this.deriveProfilePDA(addr);
                        const profile = await this.appService.queryProfile(profilePDA);
                        signedNames.push(profile?.name || addr.slice(0, 6) + '…' + addr.slice(-4));
                    } catch {
                        signedNames.push(addr.slice(0, 6) + '…' + addr.slice(-4));
                    }
                }

                // Resolve logs
                const resolvedLogs: string[] = [];
                for (const log of doc.logs) {
                    resolvedLogs.push(await this.appService.resolveLogEntry(log));
                }

                enriched.push({
                    pda: docPda.toBase58 ? docPda.toBase58() : docPda.toString(),
                    docLink: doc.docLink,
                    creatorName,
                    contributors: contriNames,
                    signedBy: signedNames,
                    logs: resolvedLogs,
                    isFinal: doc.isFinal,
                    alreadySigned,
                    signing: false,
                    logsExpanded: false,
                });
            }
            this.myDocs.set(enriched);
        } catch (err) {
            console.error('Failed to load contributor docs:', err);
        } finally {
            this.loadingDocs.set(false);
        }
    }

    async signDocument(index: number) {
        const doc = this.myDocs()[index];
        if (!doc || doc.alreadySigned || doc.isFinal) return;

        this.error.set(null);
        // Set signing state
        this.myDocs.update(docs => {
            const updated = [...docs];
            updated[index] = { ...updated[index], signing: true };
            return updated;
        });

        try {
            await this.appService.do_sign(doc.docLink);
            // Refresh list after signing
            await this.loadMyDocs();
        } catch (err: any) {
            this.error.set(this.appService.getErrorMessage(err));
            this.myDocs.update(docs => {
                const updated = [...docs];
                updated[index] = { ...updated[index], signing: false };
                return updated;
            });
        }
    }

    toggleLogs(index: number) {
        this.myDocs.update(docs => {
            const updated = [...docs];
            updated[index] = { ...updated[index], logsExpanded: !updated[index].logsExpanded };
            return updated;
        });
    }

    private async deriveProfilePDA(walletAddress: string): Promise<any> {
        const { PublicKey } = await import('@solana/web3.js');
        const seeds = [
            Buffer.from('PROFILE'),
            new PublicKey(walletAddress).toBuffer(),
        ];
        return PublicKey.findProgramAddressSync(seeds, this.appService.programId);
    }
}
