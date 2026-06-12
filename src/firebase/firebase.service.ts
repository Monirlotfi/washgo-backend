import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  /**
   * Vérifie un idToken Firebase et retourne le numéro de téléphone vérifié
   */
  async verifyPhoneToken(idToken: string): Promise<string> {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);

      if (!decoded.phone_number) {
        throw new UnauthorizedException('Token Firebase sans numéro de téléphone');
      }

      return decoded.phone_number;
    } catch (err) {
      throw new UnauthorizedException('Token Firebase invalide ou expiré');
    }
  }
}