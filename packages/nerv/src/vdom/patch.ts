/* tslint:disable: no-empty*/
import {
  isString,
  isAttrAnEvent,
  isNumber,
  isArray,
  isFunction,
  MapClass
} from 'nerv-utils'
import createElement, { mountChild } from './create-element'
import {
  Props,
  VText,
  isInvalid,
  VNode,
  isNullOrUndef,
  isValidElement,
  EMPTY_CHILDREN,
  VType
} from 'nerv-shared'
import { unmount, unmountChildren } from './unmount'
import Ref from './ref'
import { attachEvent, detachEvent } from '../event'
import SVGPropertyConfig from './svg-property-config'
import options from '../options'

/**
 * 递归patch
 *
 * @export
 * @param {*} lastVnode 节点上次渲染的结果
 * @param {*} nextVnode 根据当前state和props渲染出来的结果
 * @param {Element} parentNode 容器Dom 挂载点
 * @param {object} context childContext
 * @param {boolean} [isSvg]
 * @returns
 */
export function patch (
  lastVnode,
  nextVnode,
  parentNode: Element,
  context: object,
  isSvg?: boolean
) {
  const lastDom = lastVnode.dom
  let newDom
  // 是同类型节点吗？不是直接进行替换
  if (isSameVNode(lastVnode, nextVnode)) {
    const vtype = nextVnode.vtype
    // 使用位匹配的方式去校验节点的类型
    if (vtype & VType.Node) {
      // svg节点特别对待
      isSvg = isNullOrUndef(isSvg) ? lastVnode.isSvg : isSvg
      if (isSvg) {
        nextVnode.isSvg = isSvg
      }
      // 对比props
      patchProps(lastDom, nextVnode.props, lastVnode.props, lastVnode, isSvg)

      // 对比Children
      patchChildren(
        lastDom, // parentNode == lastDom.parentNode
        lastVnode.children,
        nextVnode.children,
        context,
        isSvg as boolean
      )
      if (nextVnode.ref !== null) {
        Ref.update(lastVnode, nextVnode, lastDom)
      }
      newDom = lastDom
    } else if ((vtype & (VType.Composite | VType.Stateless)) > 0) {
      newDom = nextVnode.update(lastVnode, nextVnode, context)
      options.afterUpdate(nextVnode)
    } else if (vtype & VType.Text) {
      return patchVText(lastVnode, nextVnode)
    } else if (vtype & VType.Portal) {
      patchChildren(lastVnode.type, lastVnode.children, nextVnode.children, context, isSvg as boolean)
    }
    // @TODO: test case
    nextVnode.dom = newDom || lastDom
  } else if (isArray(lastVnode) && isArray(nextVnode)) {
    patchArrayChildren(lastDom, lastVnode, nextVnode, context, false)
  } else {
    unmount(lastVnode)
    newDom = createElement(nextVnode, isSvg, context)
    if (nextVnode !== null) {
      nextVnode.dom = newDom
    }
    if (parentNode !== null) {
      parentNode.replaceChild(newDom, lastDom)
    }
  }
  return newDom
}

/**
 * patch数组children
 *
 * @param {Element} parentDom 是指children 的挂载点
 * @param {*} lastChildren
 * @param {*} nextChildren
 * @param {object} context
 * @param {boolean} isSvg
 */
function patchArrayChildren (
  parentDom: Element,
  lastChildren,
  nextChildren,
  context: object,
  isSvg: boolean
) {
  const lastLength = lastChildren.length
  const nextLength = nextChildren.length
  // 从无到有，就每个children都mount到parentDom中
  if (lastLength === 0) {
    if (nextLength > 0) {
      for (let i = 0; i < nextLength; i++) {
        mountChild(nextChildren[i], parentDom, context, isSvg)
      }
    }
    // 无到无 不做更新
  } else if (nextLength === 0) {
    // 从有到无 所有lastChildren unmount
    unmountChildren(lastChildren)
    // 问题? 这里为什么要置空？
    parentDom.textContent = ''
  } else {
    // 有到有
    if (isKeyed(lastChildren, nextChildren)) {
      patchKeyedChildren(
        lastChildren,
        nextChildren,
        parentDom,
        context,
        isSvg,
        lastLength,
        nextLength
      )
    } else {
      patchNonKeyedChildren(
        parentDom,
        lastChildren,
        nextChildren,
        context,
        isSvg,
        lastLength,
        nextLength
      )
    }
  }
}

/**
 * 对比Children的更新
 *
 * @export
 * @param {Element} parentDom parentDom 是指 children的挂载点
 * @param {*} lastChildren
 * @param {*} nextChildren
 * @param {object} context
 * @param {boolean} isSvg
 */
export function patchChildren (
  parentDom: Element,
  lastChildren,
  nextChildren,
  context: object,
  isSvg: boolean
) {
  // @TODO: is a better way to compatible with react-router?
  // if (lastChildren === nextChildren) {
  //   return
  // }
  const lastChildrenIsArray = isArray(lastChildren) // 是否有多个children
  const nextChildrenIsArray = isArray(nextChildren) // 是否有多个children
  if (lastChildrenIsArray && nextChildrenIsArray) {
    // 如果children有多个就用列表patch
    patchArrayChildren(parentDom, lastChildren, nextChildren, context, isSvg)
  } else if (!lastChildrenIsArray && !nextChildrenIsArray) {
    // 两个children都只有一个节点 就默认递归节点patch
    patch(lastChildren, nextChildren, parentDom, context, isSvg)
  } else if (lastChildrenIsArray && !nextChildrenIsArray) {
    // 下面两种原理都一样如果children一个是节点一个是数组的话就统一为数组对比
    patchArrayChildren(parentDom, lastChildren, [nextChildren], context, isSvg)
  } else if (!lastChildrenIsArray && nextChildrenIsArray) {
    patchArrayChildren(parentDom, [lastChildren], nextChildren, context, isSvg)
  }
}

function patchNonKeyedChildren (
  parentDom: Element,
  lastChildren,
  nextChildren,
  context: object,
  isSvg: boolean,
  lastLength: number,
  nextLength: number
) {
  const minLength = Math.min(lastLength, nextLength)
  let i = 0
  while (i < minLength) {
    patch(lastChildren[i], nextChildren[i], parentDom, context, isSvg)
    i++
  }
  if (lastLength < nextLength) {
    for (i = minLength; i < nextLength; i++) {
      if (parentDom !== null) {
        parentDom.appendChild(createElement(
          nextChildren[i],
          isSvg,
          context
        ) as Node)
      }
    }
  } else if (lastLength > nextLength) {
    for (i = minLength; i < lastLength; i++) {
      unmount(lastChildren[i], parentDom)
    }
  }
}

/**
 *
 * Virtual DOM patching algorithm based on ivi by
 * Boris Kaul (@localvoid)
 * Licensed under the MIT License
 * https://github.com/ivijs/ivi/blob/master/LICENSE
 *
 */
function patchKeyedChildren (
  a: VNode[],
  b: VNode[],
  dom: Element,
  context,
  isSvg: boolean,
  aLength: number,
  bLength: number
) {
  let aEnd = aLength - 1
  let bEnd = bLength - 1
  let aStart = 0
  let bStart = 0
  let i
  let j
  let aNode
  let bNode
  let nextNode
  let nextPos
  let node
  let aStartNode = a[aStart]
  let bStartNode = b[bStart]
  let aEndNode = a[aEnd]
  let bEndNode = b[bEnd]

  // Step 1
  // break 的 label 跳转标记
  // tslint:disable-next-line
  outer: {
    // Sync nodes with the same key at the beginning.
    while (aStartNode.key === bStartNode.key) {
      patch(aStartNode, bStartNode, dom, context, isSvg)
      aStart++
      bStart++
      if (aStart > aEnd || bStart > bEnd) {
        // 结束了
        break outer
      }
      aStartNode = a[aStart]
      bStartNode = b[bStart]
    }

    // Sync nodes with the same key at the end.
    while (aEndNode.key === bEndNode.key) {
      patch(aEndNode, bEndNode, dom, context, isSvg)
      aEnd--
      bEnd--
      if (aStart > aEnd || bStart > bEnd) {
        // 结束了
        break outer
      }
      aEndNode = a[aEnd]
      bEndNode = b[bEnd]
    }
  }
  // 以上只是对正常情况进行patch 如 a: 1-2-3-4-5   b: 1-2-3-4-5

  // 如果old的children结束了
  if (aStart > aEnd) {
    // 看看是children新增了节点的情况吗？
    if (bStart <= bEnd) {
      // 处理等于的情况， 等于下是说明指向的是新增的
      nextPos = bEnd + 1
      nextNode = nextPos < bLength ? b[nextPos].dom : null
      while (bStart <= bEnd) {
        node = b[bStart]
        bStart++
        attachNewNode(dom, createElement(node, isSvg, context), nextNode)
      }
    }
  } else if (bStart > bEnd) {
    // 如果是在原来的基础上删除了节点就unmount掉
    while (aStart <= aEnd) {
      unmount(a[aStart++], dom)
    }
  } else {
    // 重点 两种情况都不为空
    const aLeft = aEnd - aStart + 1 // 旧剩余的节点个数  1 - 0 + 1  因为实际上 0 和 1 都是新增的
    const bLeft = bEnd - bStart + 1 // 新剩余的节点个数
    const sources = new Array(bLeft) // 生成一个长度为剩余节点个数的空数组

    // Mark all nodes as inserted.
    for (i = 0; i < bLeft; i++) {
      sources[i] = -1 // source 数组保存的是不匹配的元素应该插入到的位置。
                      // - 1 代表完全新的节点插入, 其他数字代表 b[i] == a[source[i]]
    }

    let moved = false
    let pos = 0
    let patched = 0

    // When sizes are small, just loop them through
    // 问题? 这些魔法数是怎么回事 答案: 在小规模的时候直接粗暴循环判断？ 4*4 = 16次
    if (bLeft <= 4 || aLeft * bLeft <= 16) {
      for (i = aStart; i <= aEnd; i++) {
        aNode = a[i]
        if (patched < bLeft) {
          // 以b剩余的作为基准
          for (j = bStart; j <= bEnd; j++) {
            bNode = b[j]
            // 判断是不是乱序的问题
            if (aNode.key === bNode.key) {
              sources[j - bStart] = i // source数组长度只有bleft所以要j - bstart

              if (pos > j) { // 问题? 什么情况才会有pos>j 答案： break后pos值不会变，j重置如果是乱序就会 pos > j
                moved = true
              } else {
                pos = j // 记录现在遍历到的位置
              }

              patch(aNode, bNode, dom, context, isSvg) // key相同就patch对应的节点。

              patched++ // patch数量增加
              a[i] = null as any // 问题 a[i]为什么要置空？
              break // 找到就跳过继续匹配下一个old A 节点
            }
          }
        }
      }
    } else {
      // 如果乱序或数量变更的范围比较大，就不能循环判断了。
      const keyIndex = new MapClass()

      // 记录key 对应的位置 4+4次？
      for (i = bStart; i <= bEnd; i++) {
        keyIndex.set(b[i].key, i)
      }

      for (i = aStart; i <= aEnd; i++) {
        aNode = a[i]

        if (patched < bLeft) { // bleft 等于变化的数量。
          j = keyIndex.get(aNode.key)

          if (j !== undefined) {
            bNode = b[j]
            sources[j - bStart] = i // 对应到a的位置
            // pos > j是指明存在乱序情况
            if (pos > j) {
              moved = true // 标记节点需要重排
            } else {
              pos = j // a 1->2->3->4  b 4->3->2->1 对比到 2 的时候 pos=3 j=2
            }
            patch(aNode, bNode, dom, context, isSvg)
            patched++
            a[i] = null as any
          }
        }
      }
    }
    // 如果a数组被完全替换成其他的，不存在相同的节点。
    if (aLeft === aLength && patched === 0) {
      // a卸载

      unmountChildren(a)
      dom.textContent = ''
      // 插入新数组
      while (bStart < bLeft) {
        node = b[bStart]
        bStart++
        attachNewNode(dom, createElement(node, isSvg, context), null)
      }
    } else {
      // 删掉多余节点
      i = aLeft - patched
      while (i > 0) {
        aNode = a[aStart++]
        if (aNode !== null) {
          unmount(aNode, dom)
          i--
        }
      }
      // 如果是乱序的情况
      if (moved) {
        // 找出最长递增子串
        const seq = lis(sources) //
        j = seq.length - 1
        for (i = bLeft - 1; i >= 0; i--) {
          if (sources[i] === -1) {

            pos = i + bStart
            node = b[pos]
            nextPos = pos + 1
            attachNewNode(
              dom,
              createElement(node, isSvg, context),
              nextPos < bLength ? b[nextPos].dom : null
            )
          } else {
            if (j < 0 || i !== seq[j]) {
              pos = i + bStart
              node = b[pos]
              nextPos = pos + 1
              attachNewNode(
                dom,
                node.dom,
                nextPos < bLength ? b[nextPos].dom : null
              )
            } else {
              j--
            }
          }
        }
        // 如果patched 的和b剩下的数量不一致，说明有新增或者删除？的情况
      } else if (patched !== bLeft) {
        for (i = bLeft - 1; i >= 0; i--) {
          // 如果是新增的话就插入
          if (sources[i] === -1) {
            pos = i + bStart
            node = b[pos]
            nextPos = pos + 1
            attachNewNode(
              dom,
              createElement(node, isSvg, context),
              nextPos < bLength ? b[nextPos].dom : null
            )
          }
        }
      }
    }
  }
}

/**
 * 插入新节点
 *
 * @param {*} parentDom
 * @param {*} newNode
 * @param {*} nextNode
 */
function attachNewNode (parentDom, newNode, nextNode) {
  // 如果当前节点是挂载点的最后一个子节点的话 1-2-3-4-5 的5 name就appendChild
  if (isNullOrUndef(nextNode)) {
    parentDom.appendChild(newNode)
  } else {
    // 否则如果是 1-2-3-4-5 的 4 的话就使用insertBefore 5 注意DOM是没有insertAfter的
    // 因为使用insertBefore + DOM已经可以实现相同效果
    parentDom.insertBefore(newNode, nextNode)
  }
}

/**
 * Slightly modified Longest Increased Subsequence algorithm, it ignores items that have -1 value, they're representing
 * new items.
 *
 * http://en.wikipedia.org/wiki/Longest_increasing_subsequence
 *
 * @param a Array of numbers.
 * @returns Longest increasing subsequence.
 */
// 找到数组中的最长递增子序列
function lis (a: number[]): number[] {
  const p = a.slice() // 和 a.concat 一样 生成浅复制 数组
  const result: number[] = []
  result.push(0)
  let u: number
  let v: number

  for (let i = 0, il = a.length; i < il; ++i) {
    if (a[i] === -1) {
      continue
    }

    const j = result[result.length - 1]
    if (a[j] < a[i]) {
      p[i] = j
      result.push(i)
      continue
    }

    u = 0
    v = result.length - 1

    while (u < v) {
      const c = ((u + v) / 2) | 0
      if (a[result[c]] < a[i]) {
        u = c + 1
      } else {
        v = c
      }
    }

    if (a[i] < a[result[u]]) {
      if (u > 0) {
        p[i] = result[u - 1]
      }
      result[u] = i
    }
  }

  u = result.length
  v = result[u - 1]

  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }

  return result
}

/**
 * 检测数组children有没有带key属性
 * react要求数组children要带上key属性的唯一标记减少patch的次数
 *
 * @param {VNode[]} lastChildren
 * @param {VNode[]} nextChildren
 * @returns {boolean}
 */
function isKeyed (lastChildren: VNode[], nextChildren: VNode[]): boolean {

  // 问题？ 为什么只检测lastChildren和nextChildren[0]（如果只有第一个带key其他都无key怎么破）
  return (
    nextChildren.length > 0 &&
    !isNullOrUndef(nextChildren[0]) &&
    !isNullOrUndef(nextChildren[0].key) &&
    lastChildren.length > 0 &&
    !isNullOrUndef(lastChildren[0]) &&
    !isNullOrUndef(lastChildren[0].key)
  )
}

/**
 * 判断是否为相同类型的node
 *
 * @param {*} a
 * @param {*} b
 * @returns
 */
function isSameVNode (a, b) {
  // 不可转换为vNode的值和数组值 直接就return false
  if (isInvalid(a) || isInvalid(b) || isArray(a) || isArray(b)) {
    return false
  }
  // 对比type和vtype
  return a.type === b.type && a.vtype === b.vtype && a.key === b.key
}

/**
 * 更新VNodeText节点对应的文字内容
 *
 * @param {VText} lastVNode
 * @param {VText} nextVNode
 * @returns
 */
function patchVText (lastVNode: VText, nextVNode: VText) {
  const dom = lastVNode.dom
  if (dom === null) {
    return
  }
  const nextText = nextVNode.text
  nextVNode.dom = dom

  if (lastVNode.text !== nextText) {
    dom.nodeValue = nextText as string
  }
  return dom
}

const skipProps = {
  children: 1,
  key: 1,
  ref: 1,
  owner: 1
}

const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i

function setStyle (domStyle, style, value) {
  if (isNullOrUndef(value) || (isNumber(value) && isNaN(value))) {
    domStyle[style] = ''
    return
  }
  if (style === 'float') {
    // 修改元素float属性不能直接通过 obj.style.float 来改
    // IE是通过obj.style.styleFloat
    // FF等浏览器obj.style.cssFloat="left";
    domStyle['cssFloat'] = value
    domStyle['styleFloat'] = value
    return
  }
  domStyle[style] =
    !isNumber(value) || IS_NON_DIMENSIONAL.test(style) ? value : value + 'px'
}

/**
 * 移除事件再重新绑定监听器
 *
 * @param {string} eventName
 * @param {Function} lastEvent
 * @param {Function} nextEvent
 * @param {Element} domNode
 */
function patchEvent (
  eventName: string,
  lastEvent: Function,
  nextEvent: Function,
  domNode: Element
) {
  if (lastEvent !== nextEvent) {
    if (isFunction(lastEvent)) {
      detachEvent(domNode, eventName, lastEvent)
    }
    attachEvent(domNode, eventName, nextEvent)
  }
}

/**
 * 更新style属性
 *
 * @param {CSSStyleSheet} lastAttrValue
 * @param {CSSStyleSheet} nextAttrValue
 * @param {HTMLElement} dom
 */
function patchStyle (lastAttrValue: CSSStyleSheet, nextAttrValue: CSSStyleSheet, dom: HTMLElement) {
  // 通过prop设置
  const domStyle = dom.style
  let style
  let value

  if (isString(nextAttrValue)) {
    domStyle.cssText = nextAttrValue
    return
  }
  // 如果样式之前的值是一个对象
  if (!isNullOrUndef(lastAttrValue) && !isString(lastAttrValue)) {
    for (style in nextAttrValue) {
      value = nextAttrValue[style]
      if (value !== lastAttrValue[style]) {
        // 使用setStyle设置为style的字符串
        setStyle(domStyle, style, value)
      }
    }
    // 把新的style中不存在的属性置位 ''
    for (style in lastAttrValue) {
      if (isNullOrUndef(nextAttrValue[style])) {
        domStyle[style] = ''
      }
    }
  } else {
    for (style in nextAttrValue) {
      value = nextAttrValue[style]
      setStyle(domStyle, style, value)
    }
  }
}

export function patchProp (
  domNode: Element,
  prop: string,
  lastValue,
  nextValue,
  lastVnode: VNode | null,
  isSvg?: boolean
) {
  // fix the value update for textarea/input
  if (lastValue !== nextValue || prop === 'value') {
    if (prop === 'className') {
      prop = 'class'
    }
    if (skipProps[prop] === 1) {
      return
    } else if (prop === 'class' && !isSvg) {
      // dom中class 是关键字 所以改为className作为prop
      domNode.className = nextValue
    } else if (prop === 'dangerouslySetInnerHTML') {
      // 使用dangerous修改节点内容的话会导致原来的子节点会被移除
      const lastHtml = lastValue && lastValue.__html
      const nextHtml = nextValue && nextValue.__html

      // 如果当前html和更新的html不一致
      if (lastHtml !== nextHtml) {
        // 判断移除子节点的情况
        if (!isNullOrUndef(nextHtml)) {
          if (
            isValidElement(lastVnode) &&
            lastVnode.children !== EMPTY_CHILDREN
          ) {
            unmountChildren(lastVnode.children)
            lastVnode.children = []
          }
          // 否则直接改为新值
          domNode.innerHTML = nextHtml
        }
      }
    } else if (isAttrAnEvent(prop)) {
      patchEvent(prop, lastValue, nextValue, domNode)
    } else if (prop === 'style') {
      patchStyle(lastValue, nextValue, domNode as HTMLElement)
    } else if (
      prop !== 'list' &&
      prop !== 'type' &&
      !isSvg &&
      prop in domNode
    ) {
      setProperty(domNode, prop, nextValue == null ? '' : nextValue)
      if (nextValue == null || nextValue === false) {
        domNode.removeAttribute(prop)
      }
    } else if (isNullOrUndef(nextValue) || nextValue === false) {
      domNode.removeAttribute(prop)
    } else {
      const namespace = SVGPropertyConfig.DOMAttributeNamespaces[prop]
      if (isSvg && namespace) {
        if (nextValue) {
          domNode.setAttributeNS(namespace, prop, nextValue)
        } else {
          const colonPosition = prop.indexOf(':')
          const localName =
            colonPosition > -1 ? prop.substr(colonPosition + 1) : prop
          domNode.removeAttributeNS(namespace, localName)
        }
      } else {
        // 对于不带data- 前缀的自定义属性 现在改为直接更新到DOM上， 以前是报错
        if (!isFunction(nextValue)) {
          domNode.setAttribute(prop, nextValue)
        }

        // WARNING: Non-event attributes with function values:
        // https://reactjs.org/blog/2017/09/08/dom-attributes-in-react-16.html#changes-in-detail
      }
    }
  }
}

export function setProperty (node, name, value) {
  try {
    node[name] = value
  } catch (e) {}
}

/**
 *
 *
 * @param {Element} domNode
 * @param {Props} nextProps
 * @param {Props} previousProps
 * @param {VNode} lastVnode
 * @param {boolean} [isSvg]
 */
function patchProps (
  domNode: Element,
  nextProps: Props,
  previousProps: Props,
  lastVnode: VNode,
  isSvg?: boolean
) {
  // 遍历props中所有的属性 处理一个属性的值从正常值被更新为false的值
  for (const propName in previousProps) {

    const value = previousProps[propName]
    // 如果一个属性的值从正常值被更新为false的值
    if (isNullOrUndef(nextProps[propName]) && !isNullOrUndef(value)) {
      // 如果是事件监听器属性置空
      if (isAttrAnEvent(propName)) {
        // 就移除掉这个事件监听器
        detachEvent(domNode, propName, value)
      } else if (propName === 'dangerouslySetInnerHTML') {
        // 如果是以innerHTML方式直接写入的话设置为空字符串
        domNode.textContent = ''
      } else if (propName === 'className') {
        // 移除class属性
        domNode.removeAttribute('class')
      } else {
        // 默认情况直接移除对应属性
        domNode.removeAttribute(propName)
      }
    }
  }
  // 处理完特殊情况后使用patchProp更新属性
  for (const propName in nextProps) {
    patchProp(
      domNode,
      propName,
      previousProps[propName],
      nextProps[propName],
      lastVnode,
      isSvg
    )
  }
}

export default patch
