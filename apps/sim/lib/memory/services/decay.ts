
import { AffectiveVector } from '../types';

export class DecayEngine {

    private static readonly BASE_STRENGTH = 1.0;
    private static readonly NOSTALGIA_COEFFICIENT = 3.5;
    private static readonly SURVIVAL_COEFFICIENT = 2.0;
    private static readonly FRESHNESS_GRACE_PERIOD_MS = 1000 * 60 * 60 * 48; // 48 Hours

    /**
     * Calculates Retention Probability (R) at time t.
     */
    public static calculateRetentionProbability(
        timeDeltaMs: number,
        emotion: AffectiveVector,
        accessCount: number,
        createdAt?: Date
    ): number {

        // 1. Freshness Check (Import Amnesia Fix)
        if (createdAt) {
            const ingestionAge = Date.now() - createdAt.getTime();
            if (ingestionAge < this.FRESHNESS_GRACE_PERIOD_MS) {
                return 1.0;
            }
        }

        // 2. Time Normalization (t in Days)
        const t = timeDeltaMs / (1000 * 60 * 60 * 24);

        // 3. Memory Strength (S)
        const S = this.calculateMemoryStrength(emotion, accessCount);

        // 4. Ebbinghaus Equation: R = e^(-t/S)
        return Math.exp(-t / S);
    }

    private static calculateMemoryStrength(emotion: AffectiveVector, accessCount: number): number {
        let strength = this.BASE_STRENGTH;

        const positiveValence = (emotion.joy * this.NOSTALGIA_COEFFICIENT) + (emotion.trust * 1.5);
        const survivalValence = (emotion.fear * this.SURVIVAL_COEFFICIENT) + (emotion.anger * 1.2);

        strength += positiveValence + survivalValence;
        strength *= (1 + emotion.arousal);
        strength *= Math.log(Math.E + accessCount);

        return strength;
    }

    public static isCoreMemory(emotion: AffectiveVector, accessCount: number): boolean {
        if (emotion.joy > 0.9 && emotion.trust > 0.6) return true;
        if (emotion.arousal > 0.95) return true;
        if (accessCount > 50 && emotion.joy > 0.5) return true;
        return false;
    }
}
