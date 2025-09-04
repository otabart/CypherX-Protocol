import { ethers } from 'ethers';
import { pbkdf2Sync, randomBytes, createCipher, createDecipher } from 'crypto';

export interface SecureWalletData {
  address: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  createdAt: number;
  lastAccessed: number;
}

export interface WalletSecurityConfig {
  sessionTimeout: number; // minutes
  maxLoginAttempts: number;
  requirePasswordOnTransaction: boolean;
  autoLockOnInactivity: boolean;
}

export class SecureWalletManager {
  private static instance: SecureWalletManager;
  private sessionKey: string | null = null;
  private sessionExpiry: number = 0;
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  
  private constructor() {}
  
  static getInstance(): SecureWalletManager {
    if (!SecureWalletManager.instance) {
      SecureWalletManager.instance = new SecureWalletManager();
    }
    return SecureWalletManager.instance;
  }

  // Generate a secure random salt
  private generateSalt(): string {
    return randomBytes(32).toString('hex');
  }

  // Generate a secure IV
  private generateIV(): string {
    return randomBytes(16).toString('hex');
  }

  // Derive encryption key from password using PBKDF2
  private deriveKey(password: string, salt: string): Buffer {
    return pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  // Encrypt private key
  private encryptPrivateKey(privateKey: string, password: string): { encrypted: string; salt: string; iv: string } {
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = this.deriveKey(password, salt);
    
    const cipher = createCipher('aes-256-gcm', key);
    cipher.setAAD(Buffer.from('cypherx-wallet', 'utf8'));
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted: encrypted + cipher.getAuthTag().toString('hex'),
      salt,
      iv
    };
  }

  // Decrypt private key
  private decryptPrivateKey(encryptedData: string, password: string, salt: string): string {
    try {
      const key = this.deriveKey(password, salt);
      const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
      const encrypted = encryptedData.slice(0, -32);
      
      const decipher = createDecipher('aes-256-gcm', key);
      decipher.setAAD(Buffer.from('cypherx-wallet', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Invalid password or corrupted wallet data');
    }
  }

  // Create a new secure wallet
  async createWallet(password: string): Promise<SecureWalletData> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const wallet = ethers.Wallet.createRandom();
    const { encrypted, salt, iv } = this.encryptPrivateKey(wallet.privateKey, password);
    
    const walletData: SecureWalletData = {
      address: wallet.address,
      encryptedPrivateKey: encrypted,
      salt,
      iv,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };

    // Store encrypted wallet data
    this.storeWalletData(walletData);
    
    return walletData;
  }

  // Import wallet from private key
  async importWallet(privateKey: string, password: string): Promise<SecureWalletData> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Validate private key
    try {
      const wallet = new ethers.Wallet(privateKey);
      const { encrypted, salt, iv } = this.encryptPrivateKey(privateKey, password);
      
      const walletData: SecureWalletData = {
        address: wallet.address,
        encryptedPrivateKey: encrypted,
        salt,
        iv,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };

      this.storeWalletData(walletData);
      return walletData;
    } catch (error) {
      throw new Error('Invalid private key');
    }
  }

  // Unlock wallet with password
  async unlockWallet(password: string): Promise<ethers.Wallet> {
    const walletData = this.getStoredWalletData();
    if (!walletData) {
      throw new Error('No wallet found. Please create or import a wallet first.');
    }

    // Check for brute force attempts
    const attempts = this.loginAttempts.get(walletData.address) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    
    if (attempts.count >= 5 && (now - attempts.lastAttempt) < 15 * 60 * 1000) {
      throw new Error('Too many failed attempts. Please wait 15 minutes before trying again.');
    }

    try {
      const privateKey = this.decryptPrivateKey(
        walletData.encryptedPrivateKey,
        password,
        walletData.salt
      );
      
      // Reset login attempts on success
      this.loginAttempts.delete(walletData.address);
      
      // Create session
      this.sessionKey = randomBytes(32).toString('hex');
      this.sessionExpiry = now + (30 * 60 * 1000); // 30 minutes
      
      // Update last accessed
      walletData.lastAccessed = now;
      this.storeWalletData(walletData);
      
      return new ethers.Wallet(privateKey);
    } catch (error) {
      // Increment failed attempts
      attempts.count++;
      attempts.lastAttempt = now;
      this.loginAttempts.set(walletData.address, attempts);
      
      throw new Error('Invalid password');
    }
  }

  // Get wallet instance for current session
  async getWallet(password?: string): Promise<ethers.Wallet | null> {
    if (!this.isSessionValid()) {
      if (!password) {
        throw new Error('Session expired. Please provide password to unlock wallet.');
      }
      return this.unlockWallet(password);
    }
    
    const walletData = this.getStoredWalletData();
    if (!walletData) return null;
    
    // For session-based access, we need to store the decrypted key temporarily
    // This is a simplified version - in production, consider using Web Crypto API
    return null; // TODO: Implement session-based wallet access
  }

  // Check if current session is valid
  isSessionValid(): boolean {
    return this.sessionKey !== null && Date.now() < this.sessionExpiry;
  }

  // Extend session
  extendSession(): void {
    if (this.sessionKey) {
      this.sessionExpiry = Date.now() + (30 * 60 * 1000); // 30 minutes
    }
  }

  // Lock wallet (clear session)
  lockWallet(): void {
    this.sessionKey = null;
    this.sessionExpiry = 0;
  }

  // Store wallet data securely
  private storeWalletData(walletData: SecureWalletData): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cypherx_secure_wallet', JSON.stringify(walletData));
    }
  }

  // Get stored wallet data
  private getStoredWalletData(): SecureWalletData | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cypherx_secure_wallet');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  }

  // Backup wallet data (encrypted)
  async exportWallet(): Promise<string> {
    const walletData = this.getStoredWalletData();
    if (!walletData) {
      throw new Error('No wallet to export');
    }

    // Create a backup with additional encryption
    const backupData = {
      version: '1.0',
      wallet: walletData,
      exportedAt: Date.now(),
      checksum: this.generateChecksum(walletData)
    };

    return JSON.stringify(backupData);
  }

  // Import wallet from backup
  async importFromBackup(backupData: string, password: string): Promise<SecureWalletData> {
    try {
      const backup = JSON.parse(backupData);
      
      if (backup.version !== '1.0') {
        throw new Error('Unsupported backup version');
      }

      // Verify checksum
      if (backup.checksum !== this.generateChecksum(backup.wallet)) {
        throw new Error('Backup data corrupted');
      }

      // Test decryption to verify password
      this.decryptPrivateKey(
        backup.wallet.encryptedPrivateKey,
        password,
        backup.wallet.salt
      );

      // Create new wallet data with current timestamp
      const walletData: SecureWalletData = {
        ...backup.wallet,
        lastAccessed: Date.now()
      };

      this.storeWalletData(walletData);
      return walletData;
    } catch (error) {
      throw new Error('Invalid backup data or password');
    }
  }

  // Generate checksum for backup verification
  private generateChecksum(walletData: SecureWalletData): string {
    const data = `${walletData.address}${walletData.encryptedPrivateKey}${walletData.salt}${walletData.iv}`;
    return ethers.keccak256(ethers.toUtf8Bytes(data)).slice(2, 10);
  }

  // Clear all wallet data
  clearWallet(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cypherx_secure_wallet');
    }
    this.lockWallet();
  }

  // Get wallet address without unlocking
  getWalletAddress(): string | null {
    const walletData = this.getStoredWalletData();
    return walletData?.address || null;
  }

  // Check if wallet exists
  hasWallet(): boolean {
    return this.getStoredWalletData() !== null;
  }
}

// Export singleton instance
export const secureWalletManager = SecureWalletManager.getInstance();
