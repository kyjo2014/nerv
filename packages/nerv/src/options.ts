import { noop, CompositeComponent, StatelessComponent, VirtualNode } from 'nerv-shared'

export type optionsHook = (vnode: CompositeComponent | StatelessComponent) => void

// 这个是用于提供钩子的挂载点。像devtool就会使用beforeUnmount挂载点
// 用于监测unmount的行为
const options: {
  afterMount: optionsHook
  afterUpdate: optionsHook
  beforeUnmount: optionsHook
  roots: VirtualNode[],
  debug: boolean
} = {
    afterMount: noop,
    afterUpdate: noop,
    beforeUnmount: noop,
    roots: [],
    debug: false
  }

export default options
