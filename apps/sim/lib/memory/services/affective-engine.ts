
import { AffectiveVector, Vector512 } from '../types';

export class AffectiveEngine {

    /**
     * Chebyshev Polynomial Expansion (T_n).
     * Transforms a simple vector (basic emotions) into a complex holographic signature.
     * 
     * EQUATION:
     * T_0(x) = 1
     * T_1(x) = x
     * T_n(x) = 2x * T_{n-1}(x) - T_{n-2}(x)
     */
    public static expandToChebyshev(baseVector: AffectiveVector): Vector512 {
        // 1. Semantic Flattening [-1, 1]
        const inputSignal = [
            (baseVector.joy * 2) - 1,
            (baseVector.trust * 2) - 1,
            (baseVector.fear * 2) - 1,
            (baseVector.surprise * 2) - 1,
            (baseVector.sadness * 2) - 1,
            (baseVector.disgust * 2) - 1,
            (baseVector.anger * 2) - 1,
            (baseVector.anticipation * 2) - 1,
            (baseVector.arousal * 2) - 1
        ];

        const output: number[] = new Array(512);

        // 2. Harmonic Generation
        for (let i = 0; i < 512; i++) {
            const inputIndex = i % inputSignal.length;
            const x = inputSignal[inputIndex];

            const degree = Math.floor(i / inputSignal.length) + 1;

            output[i] = this.chebyshevRecursive(degree, x);
        }

        return output;
    }

    /**
     * Calculates Emotional Kinetic Energy (Temperature).
     * T = ||V|| * (1 + Arousal^2)
     */
    public static calculateEmotionalTemperature(vector: AffectiveVector): number {
        const activeMagnitude = Math.sqrt(
            Math.pow(vector.anger, 2) +
            Math.pow(vector.fear, 2) +
            Math.pow(vector.joy, 2) +
            Math.pow(vector.surprise, 2)
        );

        return activeMagnitude * (1 + Math.pow(vector.arousal, 2));
    }

    private static chebyshevRecursive(n: number, x: number): number {
        if (n === 0) return 1;
        if (n === 1) return x;

        let t_prev2 = 1; // T_{n-2}
        let t_prev1 = x; // T_{n-1}
        let t_current = x;

        for (let k = 2; k <= n; k++) {
            t_current = 2 * x * t_prev1 - t_prev2;
            t_prev2 = t_prev1;
            t_prev1 = t_current;
        }

        return t_current;
    }
}
