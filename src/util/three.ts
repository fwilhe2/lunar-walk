import * as THREE from 'three';

/* three types a ShaderMaterial's uniforms as a string-keyed bag of
   `any`, so a misspelt name or a wrong value type goes unnoticed.
   This subclass only narrows the declared type (a declare field emits
   nothing): the uniforms object it is given is the one it keeps, as
   ShaderMaterial does, and reads and writes through it are typed. A
   uniform that starts empty is written new THREE.Uniform<T>(null) to
   say what it will hold. */
export type Uniforms = Record<string, THREE.IUniform>;

export class TypedShaderMaterial<U extends Uniforms> extends THREE.ShaderMaterial {
  declare uniforms: U;
  constructor(parameters: THREE.ShaderMaterialParameters & { uniforms: U }) {
    super(parameters);
  }
}
