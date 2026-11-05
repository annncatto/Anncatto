import {copyDesign, generateRobot, property, type ConceptDesign, type RobotModel} from './concept-model.js';
import {analyzeDesign, type DesignConditions, type DesignAnalysis} from './design-analysis.js';
import {materials, type Material} from './lightweight-mechanics.js';

export type MaterialComparisonMode = 'fixed' | 'sized';
export type MaterialLimit = 'drive-compliance' | 'envelope' | null;
export type MaterialFailure = 'connection' | 'deflection' | 'strength' | 'both' | null;
export interface MaterialCandidate {
  material: Material;
  design: ConceptDesign;
  analysis: DesignAnalysis;
  scale: number;
  memberMass: number;
  feasible: boolean;
  limit: MaterialLimit;
  failure:MaterialFailure;
}

/** Change only this member. Other members, interfaces and actuator masses stay fixed. */
export function memberMaterialDesign(design: ConceptDesign, memberId: string, material: Material): ConceptDesign {
  const next = copyDesign(design);
  next.parts[memberId] = {...next.parts[memberId], material, properties: property(material)};
  return next;
}

/**
 * Similar-section sizing: b, h and t scale together; length and attachment positions
 * are fixed. I ~ s^4, section modulus ~ s^3 and area ~ s^2. The root spring does not
 * scale. This screens transverse deflection and bending strength, not fatigue,
 * local buckling, actuator rating, mode separation or assembled envelope clearance.
 */
export function compareMemberMaterials(
  model: RobotModel, conditions: DesignConditions, memberId: string,
  mode: MaterialComparisonMode, maxOuterSize = .12,
): MaterialCandidate[] {
  const selected = model.nodes.find(node => node.id === memberId && node.member);
  if (!selected?.member) throw Error('Select a structural member');
  const section = selected.member;
  return (Object.keys(materials) as Material[]).map(material => {
    const design = memberMaterialDesign(model.design, memberId, material);
    let analysis = analyzeDesign(generateRobot(design), conditions, memberId);
    let scale = 1;
    let limit: MaterialLimit = null;
    if (mode === 'sized') {
      const driveDeflection = design.tipForce * analysis.driveCompliance;
      const remaining = design.allowDeflection - driveDeflection;
      const minimum = Math.max(.008 / section.height,
        section.section === 'tube' ? 0 : .008 / section.width,
        section.section === 'solid' ? 0 : design.minWall / section.wall);
      const maximum = maxOuterSize / (section.section === 'tube' ? section.height : Math.max(section.width, section.height));
      const deflectionScale = design.tipForce === 0 ? 0 : remaining <= 0 ? Infinity : (analysis.beamDeflection / remaining) ** .25;
      const required = Math.max(minimum, deflectionScale, Math.cbrt(analysis.strengthUse));
      limit = !Number.isFinite(required) ? 'drive-compliance' : required > maximum * (1 + 1e-9) ? 'envelope' : null;
      // With no remaining deflection budget, larger sections cannot help.
      // Keep the current geometry instead of inventing a maximum-size trial.
      scale = limit==='drive-compliance'?1:Math.min(required, maximum);
      if (maximum < minimum) limit = 'envelope';
      // A failed candidate still shows an explicit, bounded trial geometry.
      scale = Math.max(1e-4, scale);
      design.parts[memberId] = {...design.parts[memberId], section: section.section,
        width: section.width * scale, height: section.height * scale, wall: section.wall * scale};
      analysis = analyzeDesign(generateRobot(design), conditions, memberId);
    }
    const memberMass = analysis.member.components.filter(component => component.role === 'member').reduce((sum, component) => sum + component.mass, 0);
    const deflectionFailed=analysis.deflectionUse>1+1e-8,strengthFailed=analysis.strengthUse>1+1e-8;
    const failure:MaterialFailure=design.tipForce*analysis.driveCompliance>=design.allowDeflection&&(deflectionFailed||mode==='sized')?'connection':deflectionFailed&&strengthFailed?'both':deflectionFailed?'deflection':strengthFailed?'strength':null;
    return {material, design, analysis, scale, memberMass, limit,failure,
      feasible: !limit && analysis.strengthUse <= 1 + 1e-8 && analysis.deflectionUse <= 1 + 1e-8};
  });
}
