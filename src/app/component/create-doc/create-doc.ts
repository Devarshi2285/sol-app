import { Component, inject, signal, WritableSignal } from '@angular/core';
import { AppService } from '../../app-service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface EnrichedDoc {
  pda: string;
  docLink: string;
  contributors: string[];      // resolved names
  signedBy: string[];           // resolved names
  logs: string[];               // resolved log entries
  isFinal: boolean;
  logsExpanded: boolean;
}

@Component({
  selector: 'app-create-doc',
  imports: [FormsModule, CommonModule],
  templateUrl: './create-doc.html',
  styleUrl: './create-doc.css',
})
export class CreateDoc {

  private service = inject(AppService);

  contributers: WritableSignal<string[]> = signal([]);
  contributer = '';
  docLink = '';
  isLoading = false;
  loadingDocs = signal(true);
  error: WritableSignal<string | null> = signal(null);
  myDocs: WritableSignal<EnrichedDoc[]> = signal([]);

  async ngOnInit() {
    await this.service.connectWallat();
    await this.loadMyDocs();
  }

  addContributer() {
    const val = this.contributer.trim();
    if (!val) return;
    this.contributers.update(prev => [...prev, val]);
    this.contributer = '';
  }

  removeContributer(index: number) {
    this.contributers.update(prev => prev.filter((_, i) => i !== index));
  }

  async addDoc() {
    if (!this.docLink) return;
    if (this.contributers().length === 0) {
      this.error.set('At least one contributor is required.');
      return;
    }
    this.isLoading = true;
    this.error.set(null);
    try {
      await this.service.create_doc(this.docLink, this.contributers());
      // Reset form
      this.docLink = '';
      this.contributers.set([]);
      // Refresh doc list
      await this.loadMyDocs();
    } catch (err: any) {
      this.error.set(this.service.getErrorMessage(err));
    } finally {
      this.isLoading = false;
    }
  }

  async loadMyDocs() {
    this.loadingDocs.set(true);
    try {
      const index = await this.service.queryCreatorIndex();
      if (!index || !index.docs.length) {
        this.myDocs.set([]);
        return;
      }

      const enriched: EnrichedDoc[] = [];
      for (const docPda of index.docs) {
        const doc = await this.service.queryDoc(docPda);
        if (!doc) continue;

        // Resolve contributor names
        const contriNames: string[] = [];
        for (const c of doc.contributers) {
          const addr = c.toBase58 ? c.toBase58() : c.toString();
          // Try to resolve as profile PDA
          try {
            const [profilePDA] = await this.deriveProfilePDA(addr);
            const profile = await this.service.queryProfile(profilePDA);
            contriNames.push(profile?.name || addr.slice(0, 6) + '…' + addr.slice(-4));
          } catch {
            contriNames.push(addr.slice(0, 6) + '…' + addr.slice(-4));
          }
        }

        // Resolve signedBy names
        const signedNames: string[] = [];
        for (const s of doc.signedBy) {
          const addr = s.toBase58 ? s.toBase58() : s.toString();
          try {
            const [profilePDA] = await this.deriveProfilePDA(addr);
            const profile = await this.service.queryProfile(profilePDA);
            signedNames.push(profile?.name || addr.slice(0, 6) + '…' + addr.slice(-4));
          } catch {
            signedNames.push(addr.slice(0, 6) + '…' + addr.slice(-4));
          }
        }

        // Resolve logs
        const resolvedLogs: string[] = [];
        for (const log of doc.logs) {
          const resolved = await this.service.resolveLogEntry(log);
          resolvedLogs.push(resolved);
        }

        enriched.push({
          pda: docPda.toBase58 ? docPda.toBase58() : docPda.toString(),
          docLink: doc.docLink,
          contributors: contriNames,
          signedBy: signedNames,
          logs: resolvedLogs,
          isFinal: doc.isFinal,
          logsExpanded: false,
        });
      }
      this.myDocs.set(enriched);
    } catch (err) {
      console.error('Failed to load docs:', err);
    } finally {
      this.loadingDocs.set(false);
    }
  }

  private async deriveProfilePDA(walletAddress: string): Promise<any> {
    const { PublicKey } = await import('@solana/web3.js');
    const seeds = [
      Buffer.from('PROFILE'),
      new PublicKey(walletAddress).toBuffer(),
    ];
    return PublicKey.findProgramAddressSync(seeds, this.service.programId);
  }

  toggleLogs(index: number) {
    this.myDocs.update(docs => {
      const updated = [...docs];
      updated[index] = { ...updated[index], logsExpanded: !updated[index].logsExpanded };
      return updated;
    });
  }
}
