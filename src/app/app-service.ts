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
      await this.initContributorIndex();
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

  // Initialize a contributor's ContributorIndex (must be called by the contributor themselves)
  async initContributorIndex() {
    const [contributorPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("CONTRIBUTORINDEX"),
        this.wallat.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    const tx = await (this.program.methods as any)
      .createContributerIndex()
      .accounts({
        contributor: contributorPDA,
        signer: this.wallat.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    await this.sendTx(tx);
  }

  async create_doc(docLink: any, contributers: any) {

    const [docPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("DOC"),
        this.wallat.publicKey.toBuffer(),
        Buffer.from(docLink),
      ],
      this.program.programId
    );

    const [creatorPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("CREATORINDEX"),
        this.wallat.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    console.log(docPDA.toBase58(), this.wallat)

    // Validate and sanitize contributor addresses
    const cleanedContributers = contributers.map((addr: string) => addr.trim());
    for (const addr of cleanedContributers) {
      try {
        new PublicKey(addr);
      } catch {
        throw new Error(`Invalid contributor address: "${addr}". Must be a valid Solana wallet address.`);
      }
    }

    const contributersPubKey = cleanedContributers.map(
      (addr: string) => new PublicKey(addr)
    );

    const contributersPDA = contributers.map(
      (addr: string) => {
        const [contributerPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("CONTRIBUTORINDEX"),
            new PublicKey(addr).toBuffer(),
          ],
          this.program.programId
        );
        return contributerPDA;
      }
    );

    // Pre-check: verify each contributor's ContributorIndex account exists and is program-owned
    const unregistered: string[] = [];
    for (let i = 0; i < contributersPDA.length; i++) {
      const accInfo = await this.connection.getAccountInfo(contributersPDA[i]);
      if (!accInfo || accInfo.owner.toBase58() !== this.programId.toBase58()) {
        const addr = contributers[i];
        unregistered.push(addr.slice(0, 6) + '…' + addr.slice(-4));
      }
    }
    if (unregistered.length > 0) {
      throw new Error(
        `These contributors have not registered their ContributorIndex yet: ${unregistered.join(', ')}. Each contributor must register before being added to a document.`
      );
    }

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
    await this.sendTx(tx);

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
          this.wallat.publicKey.toBuffer(),
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
          this.wallat.publicKey.toBuffer(),
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
      // Log format: "Signed <walletPubkey>"
      const parts = log.split(' ');
      if (parts.length >= 2 && parts[0] === 'Signed') {
        const walletKey = new PublicKey(parts[1]);
        // Derive the profile PDA from the wallet key
        const [profilePDA] = PublicKey.findProgramAddressSync(
          [Buffer.from('PROFILE'), walletKey.toBuffer()],
          this.programId
        );
        const profile = await this.queryProfile(profilePDA);
        if (profile && profile.name) {
          return `Signed by ${profile.name}`;
        }
        // Fallback: show truncated wallet address
        return `Signed by ${parts[1].slice(0, 6)}…${parts[1].slice(-4)}`;
      }
      return log;
    } catch {
      return log;
    }
  }

  getErrorMessage(err: any): string {
    const msg = err?.message || err?.toString() || '';

    // Also check Anchor logs array if present
    const logs: string[] = err?.logs || err?.simulationResponse?.logs || [];
    const allText = msg + ' ' + logs.join(' ');

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
      if (allText.includes(code.toString()) || allText.includes(message)) {
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
      if (allText.includes(name)) {
        return message;
      }
    }

    // Extract Anchor error code from logs pattern: "Error Code: <name>"
    const anchorMatch = allText.match(/Error Code: (\w+)/);
    if (anchorMatch && nameMap[anchorMatch[1]]) {
      return nameMap[anchorMatch[1]];
    }

    // Check for common Solana errors
    if (allText.includes('already in use')) {
      return 'This account already exists on-chain.';
    }
    if (allText.includes('insufficient funds') || allText.includes('Insufficient')) {
      return 'Insufficient SOL balance to complete the transaction.';
    }
    if (allText.includes('User rejected')) {
      return 'Transaction was rejected by the wallet.';
    }

    console.error('Unhandled Solana error:', msg, logs);
    return 'Something went wrong: ' + (msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
  }

}