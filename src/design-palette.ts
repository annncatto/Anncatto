import type {Component} from './concept-model.js';

/** Display colors sampled from the supplied OpenWAM figure; not material data. */
export const designPalette = {
  ink:'#181818', muted:'#4b4b4b', white:'#ffffff', neutral:'#ebebeb', background:'#f7f7f7',
  blueLight:'#e6effe', blue:'#d3e0fe', blueGray:'#b5c2e0',
  greenLight:'#eaf6d8', green:'#dcf0be', greenLine:'#4e7b23',
  peach:'#ffebe1', pink:'#ffe9e6', cream:'#fff4e1',
  selected:'#5d8dfd', blueStrong:'#2457df', red:'#f5433e', orange:'#f7883e', yellow:'#f6b14f',
} as const;

export const componentColors:Record<Component['role'],string> = {
  body:designPalette.neutral, member:designPalette.blue, motor:designPalette.peach,
  collar:designPalette.blueGray, foot:designPalette.pink, tool:designPalette.pink,
  payload:designPalette.cream, belt:designPalette.green,
};

export function displayComponentColor(component:Pick<Component,'role'|'shape'|'mesh'>, aloha=false):string {
  if(aloha&&component.shape==='mesh'){
    // The source URDF is white / CAD gray. These are whole-link display groups,
    // not an inferred split between a joint's motor and structural components.
    switch(component.mesh){
      case 'left_Rotation_Pitch':
      case 'left_Wrist_Pitch_Roll': return designPalette.peach;
      case 'left_Upper_Arm':
      case 'left_Lower_Arm':
      case 'left_wrist_yaw': return designPalette.blue;
      case 'left_Fixed_Jaw':
      case 'left_Moving_Jaw': return designPalette.pink;
      default:return designPalette.neutral;
    }
  }
  return componentColors[component.role];
}
