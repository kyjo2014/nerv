// tslint:disable:no-conditional-assignment
import { render } from './render'

/**
 * reactv16中提供的ssrAPI 用于在ssr渲染出来的内容上绑定事件监听器 与 reactDOM.render 效果差不多
 * 为什么要提供这个API可参考https://www.zhihu.com/question/66068748
 * @export
 * @param {*} vnode
 * @param {Element} container
 * @param {Function} [callback]
 * @returns
 */
export function hydrate (vnode, container: Element, callback?: Function) {
  if (container !== null) {
    // lastChild causes less reflow than firstChild
    let dom = container.lastChild as Element
    // there should be only a single entry for the root
    // 移除所有container中所有dom元素？？？？ 然后再render一次？
    while (dom) {
      const next = dom.previousSibling
      container.removeChild(dom)
      dom = next as Element
    }
    return render(vnode, container, callback)
  }
}
