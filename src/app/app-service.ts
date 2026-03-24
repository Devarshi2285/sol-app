import { Injectable } from '@angular/core';
import * as anchor from '@project-serum/anchor';
import {
  Connection,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';

import idl from './idl/idl.json';

@Injectable({
  providedIn: 'root',
})
export class AppService {

  connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed" // ✅ important
  );

  programId = new PublicKey(
    '3kYMp6sCsTFeTrDzLHNHcmiLtcWuuLu8UfRtMRbssy6H'
  );

  provider!: anchor.AnchorProvider;
  program!: anchor.Program;
  wallat: any;

  // 🔌 Connect wallet
  async connectWallat() {
    const wallatProvider = (window as any).solana;

    if (!wallatProvider) {
      alert("Install Solana wallet (Phantom)");
      return;
    }

    await wallatProvider.connect();
    this.wallat = wallatProvider;

    this.provider = new anchor.AnchorProvider(
      this.connection,
      this.wallat,
      { commitment: "confirmed" }
    );

    this.program = new anchor.Program(
      idl as anchor.Idl,
      this.programId,
      this.provider
    );

    console.log("Connected to backend");
  }

  async sendTx(tx: any) {
    tx.feePayer = this.wallat.publicKey;

    const latestBlockhash = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;

    // 3️⃣ Sign with new account (REQUIRED)
    // tx.partialSign(newAccount);

    // 4️⃣ Wallet signs
    const signedTx = await this.wallat.signTransaction(tx);

    // 5️⃣ Send transaction
    const txid = await this.connection.sendRawTransaction(
      signedTx.serialize()
    );

    console.log("TX:", txid);

    // 6️⃣ Confirm properly
    await this.connection.confirmTransaction({
      signature: txid,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    // 7️⃣ Wait a bit (Devnet lag fix)
    await new Promise(res => setTimeout(res, 1500));

  }



  // 🚀 Register function
  async register(uname: string, pass: string) {
    console.log("SIGNER:", this.wallat.publicKey.toBase58());
    const profilePDAPublicKey = this.generatePDA("PROFILE")
    console.log("NEW ACCOUNT:", profilePDAPublicKey.toBase58());

    // 1️⃣ Build transaction (NOT rpc)
    const tx = await (this.program.methods as any)
      .createProfile(uname, pass)
      .accounts({
        profile: profilePDAPublicKey, // ✅ camelCase
        signer: this.wallat.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    try {
      await this.sendTx(tx);
    }
    catch (err: any) {
      console.log(err);
      alert(this.getErrorMessage(err));
    }

    await this.queryProfile(profilePDAPublicKey);

  }

  async queryProfile(profilePDAPublicKey: any) {
    try {
      const profile = await this.program.account['profile'].fetch(profilePDAPublicKey);
      console.log(profile['authority'].toBase58());
      console.log(profile['name']);
      console.log(profile['password']);

      return {
        authority: profile['authority'].toBase58(),
        name: profile['name'],
        password: profile['password']
      }
    } catch (err: any) {
      return null;
    }
  }

  async create_doc(docLink: any, contributers: any) {

    const [docPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("DOC"),
        Buffer.from(this.wallat.publicKey.toBase58()),
        Buffer.from(docLink),
      ],
      this.program.programId
    );

    const [creatorPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("CREATORINDEX"),
        Buffer.from(this.wallat.publicKey.toBase58()),
      ],
      this.program.programId
    );

    console.log(docPDA.toBase58(), this.wallat)
    const contributersPubKey = contributers.map(
      (addr: string) => new PublicKey(addr)
    );

    const contributersPDA = contributers.map(
      (addr: string) => {
        const [contributerPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("CONTRIBUTORINDEX"),
            Buffer.from(addr),
          ],
          this.program.programId
        );
        return contributerPDA;
      }
    );

    const tx = await (this.program.methods as any)
      .createDoc(docLink, contributersPubKey)
      .accounts({
        doc: docPDA,
        creatorIndex: creatorPDA,
        signer: this.wallat.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(
        contributersPDA.map((pda: PublicKey) => ({
          pubkey: pda,
          isSigner: false,
          isWritable: true,
        }))
      )
      .transaction();
    try {
      await this.sendTx(tx);
    }
    catch (err: any) {
      console.log(err);

      const errorMsg = this.getErrorMessage(err);

      if (errorMsg.includes("already exists")) {
        alert(errorMsg);
        await this.queryDoc(docPDA);
      } else {
        alert(errorMsg);
      }
    }

  }

  async queryDoc(docPda: any) {
    try {
      const doc = await this.program.account['document'].fetch(docPda);

      console.log(doc['creator'].toBase58());
      console.log(doc['docLink']);
      console.log(doc['contributers']);
      console.log(doc['signedBy']);
      console.log(doc['logs']);
      console.log(doc['isFinal']);


      const contributersPubKey = doc['contributers'].map(
        (addr: string) => new PublicKey(addr)
      );

      return {
        creator: doc['creator'].toBase58(),
        docLink: doc['docLink'],
        contributers: contributersPubKey,
        signedBy: doc['signedBy'],
        logs: doc['logs'],
        isFinal: doc['isFinal']
      }

    } catch (err: any) {
      return null;
    }

  }

  generatePDA(initBuffer: any) {
    const seeds = [
      Buffer.from(initBuffer),
      this.wallat.publicKey.toBuffer()
    ]
    const [profilePDAPublicKey, bumpSeed] = PublicKey.findProgramAddressSync(
      seeds,
      this.programId
    )

    return profilePDAPublicKey;
  }


  async do_sign(docPda: PublicKey | string) {

    const profilePDAPublicKey = this.generatePDA("PROFILE");

    const docPDAKey = typeof docPda === 'string' ? new PublicKey(docPda) : docPda;

    const tx = await (this.program.methods as any)
      .signDoc()
      .accounts({
        doc: docPDAKey,
        profile: profilePDAPublicKey,
        signer: this.wallat.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    try {
      await this.sendTx(tx);
    }
    catch (err: any) {
      console.log(err);

      const errorMsg = this.getErrorMessage(err);
      alert(errorMsg);
      throw err;
    }

    return await this.queryDoc(docPDAKey);

  }


  // ── Query Helpers (read-only) ──

  async queryCreatorIndex(): Promise<{ creator: string; docs: any[] } | null> {
    try {
      const [creatorPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("CREATORINDEX"),
          Buffer.from(this.wallat.publicKey.toBase58()),
        ],
        this.program.programId
      );
      const data = await this.program.account['creatorIndex'].fetch(creatorPDA);
      return {
        creator: data['creator'].toBase58(),
        docs: data['docs'], // PublicKey[]
      };
    } catch (err: any) {
      return null;
    }
  }

  async queryContributorIndex(): Promise<{ contributor: string; docs: any[] } | null> {
    try {
      const [contributorPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("CONTRIBUTORINDEX"),
          Buffer.from(this.wallat.publicKey.toBase58()),
        ],
        this.program.programId
      );
      const data = await this.program.account['contributorIndex'].fetch(contributorPDA);
      return {
        contributor: data['contributor'].toBase58(),
        docs: data['docs'], // PublicKey[]
      };
    } catch (err: any) {
      return null;
    }
  }

  async resolveLogEntry(log: string): Promise<string> {
    try {
      // Log format: "Signed <profilePDA>"
      const parts = log.split(' ');
      if (parts.length >= 2 && parts[0] === 'Signed') {
        const pdaStr = parts[1];
        const pda = new PublicKey(pdaStr);
        const profile = await this.queryProfile(pda);
        if (profile && profile.name) {
          return `Signed by ${profile.name}`;
        }
      }
      return log;
    } catch {
      return log;
    }
  }

  getErrorMessage(err: any): string {
    const msg = err?.message || err?.toString() || '';

    const errorMap: Record<number, string> = {
      6000: 'Profile already exists for this wallet.',
      6001: 'A document with this link already exists.',
      6002: 'Creator index already initialized.',
      6003: 'Contributor accounts count doesn\'t match.',
      6004: 'Invalid contributor address provided.',
      6005: 'Duplicate contributor addresses detected.',
      6006: 'At least one contributor is required.',
      6007: 'Document link is empty or too long (max 200 chars).',
      6008: 'Account owner mismatch.',
      6009: 'Required account is not writable.',
      6010: 'Maximum document limit reached.',
    };

    for (const [code, message] of Object.entries(errorMap)) {
      if (msg.includes(code.toString()) || msg.includes(message)) {
        return message;
      }
    }

    // Check for error name matches
    const nameMap: Record<string, string> = {
      'ProfileAlreadyExists': errorMap[6000],
      'DocumentAlreadyExists': errorMap[6001],
      'CreatorIndexAlreadyExists': errorMap[6002],
      'InvalidAccountsLength': errorMap[6003],
      'InvalidContributor': errorMap[6004],
      'DuplicateContributor': errorMap[6005],
      'NoContributors': errorMap[6006],
      'InvalidDocLink': errorMap[6007],
      'InvalidAccountOwner': errorMap[6008],
      'AccountNotWritable': errorMap[6009],
      'MaxDocsReached': errorMap[6010],
    };

    for (const [name, message] of Object.entries(nameMap)) {
      if (msg.includes(name)) {
        return message;
      }
    }

    return 'Something went wrong. Please try again.';
  }

}