/** Qualitative design-cost model; coordinates and tangency use the same function. */
export const costMinimumMass=.62;
export const valueAdjustedMass=.35;
export function designCost(m:number){const d=m-costMinimumMass;return .8+3*d*d+18*d**4;}
export function designCostSlope(m:number){const d=m-costMinimumMass;return 6*d+72*d**3;}
export const massValue=-designCostSlope(valueAdjustedMass);
export function valueTangent(m:number){return designCost(valueAdjustedMass)+designCostSlope(valueAdjustedMass)*(m-valueAdjustedMass);}
