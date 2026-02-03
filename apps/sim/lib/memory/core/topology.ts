import { CognitiveNode, SynapticEdge } from '../types';
import { sql } from '../db/postgres';

export class GraphTopology {

    public static async pruneOrphans() {
        console.log("🧹 CORTEX :: RUNNING_SYNAPTIC_MAINTENANCE...");

        await sql`
      UPDATE graph_edges 
      SET weight = weight * 0.95 
      WHERE updated_at < NOW() - INTERVAL '24 hours'
    `;

        const deletedEdges = await sql`
      DELETE FROM graph_edges
      WHERE weight < 0.01
      AND updated_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `;

        if (deletedEdges.length > 0) {
            console.log(`🧹 CORTEX :: MAINTENANCE_REPORT => Pruned ${deletedEdges.length} noise synapses. ZERO nodes deleted.`);
        } else {
            console.log("✨ CORTEX :: MAINTENANCE_REPORT => System Clean. Eternal Memory Integrity Preserved.");
        }
    }

    public static calculateCognitiveMass(
        nodes: CognitiveNode[],
        edges: SynapticEdge[]
    ): Map<string, number> {
        const damping = 0.85;
        const iterations = 10;

        let massMap = new Map<string, number>();

        nodes.forEach(n => massMap.set(n.uuid, n.mass || 1.0));

        for (let i = 0; i < iterations; i++) {
            const newMassMap = new Map<string, number>();

            nodes.forEach(node => {
                let incomingMass = 0;
                const incomingEdges = edges.filter(e => e.target_uuid === node.uuid);

                incomingEdges.forEach(edge => {
                    const sourceNodeId = edge.source_uuid;
                    const sourceMass = massMap.get(sourceNodeId) || 1.0;
                    const outDegree = edges.filter(e => e.source_uuid === sourceNodeId).length || 1;

                    incomingMass += (sourceMass * edge.weight) / outDegree;
                });

                const currentMass = massMap.get(node.uuid) || 1.0;
                const pr = (1 - damping) * currentMass + (damping * incomingMass);
                newMassMap.set(node.uuid, pr);
            });
            massMap = newMassMap;
        }
        return massMap;
    }
}
