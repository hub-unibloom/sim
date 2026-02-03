
import { AffectiveVector, Vector512 } from '../types';
import { AffectiveEngine } from '../services/affective-engine';

export class LimbicCore {
    private static clampVector(v: AffectiveVector): AffectiveVector {
        const clamp = (n: number) => Math.min(Math.max(n, 0), 1.0);
        return {
            joy: clamp(v.joy),
            trust: clamp(v.trust),
            fear: clamp(v.fear),
            surprise: clamp(v.surprise),
            sadness: clamp(v.sadness),
            disgust: clamp(v.disgust),
            anger: clamp(v.anger),
            anticipation: clamp(v.anticipation),
            arousal: clamp(v.arousal)
        };
    }

    public static synthesizeEmotionFromPacket(analysis: any): AffectiveVector {
        const primary = analysis?.primary_emotion || '';
        const secondary = analysis?.secondary_emotion || '';
        const magnitude = Number(analysis?.magnitude) || 0.5;

        const vector: AffectiveVector = {
            joy: 0, trust: 0, fear: 0, surprise: 0,
            sadness: 0, disgust: 0, anger: 0, anticipation: 0,
            arousal: magnitude
        };

        const mapEmotion = (label: string, intensity: number) => {
            if (!label) return;
            const l = label.toLowerCase();

            if (l.includes('joy') || l.includes('happy') || l.includes('love')) vector.joy += intensity;
            if (l.includes('trust') || l.includes('grateful') || l.includes('thanks')) vector.trust += intensity;
            if (l.includes('fear') || l.includes('nervous') || l.includes('anxiety')) vector.fear += intensity;
            if (l.includes('surprise') || l.includes('shock') || l.includes('wow')) vector.surprise += intensity;
            if (l.includes('sadness') || l.includes('grief') || l.includes('cry')) vector.sadness += intensity;
            if (l.includes('disgust') || l.includes('hate') || l.includes('gross')) vector.disgust += intensity;
            if (l.includes('anger') || l.includes('mad') || l.includes('furious')) vector.anger += intensity;
            if (l.includes('anticipation') || l.includes('excited') || l.includes('haste') || l.includes('urgent')) vector.anticipation += intensity;
        };

        mapEmotion(primary, magnitude);
        mapEmotion(secondary, magnitude * 0.5);

        if (vector.anger === 0 && vector.sadness === 0 && vector.fear === 0 && vector.disgust === 0) {
            vector.trust = Math.max(vector.trust, 0.3);
        }

        return this.clampVector(vector);
    }

    public static expandToChebyshev(baseVector: AffectiveVector): Vector512 {
        return AffectiveEngine.expandToChebyshev(this.clampVector(baseVector));
    }

    public static calculateEmotionalTemperature(vector: AffectiveVector): number {
        return AffectiveEngine.calculateEmotionalTemperature(vector);
    }

    public static calculateSaudadeIndex(lastInteractionDate: Date, emotionalHomeostasis: AffectiveVector): number {
        const now = new Date();
        const hoursAbsent = Math.max(0, (now.getTime() - lastInteractionDate.getTime()) / (1000 * 3600));

        if (hoursAbsent < 24) return 0;

        const bondFactor = (emotionalHomeostasis.joy * 1.5) + emotionalHomeostasis.trust - (emotionalHomeostasis.disgust * 0.5);

        if (bondFactor <= 0) return 0;

        const timeFactor = Math.log10(1 + hoursAbsent);
        return bondFactor * timeFactor;
    }
}
