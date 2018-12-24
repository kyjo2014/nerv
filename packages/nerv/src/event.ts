import { isFunction, MapClass, doc, isBrowser } from 'nerv-utils'
import { noop } from 'nerv-shared'

const ONINPUT = 'oninput'
const ONPROPERTYCHANGE = 'onpropertychange' // IE专属
const isiOS =
  isBrowser &&
  !!navigator.platform &&
  /iPad|iPhone|iPod/.test(navigator.platform)

  // 保存代理的事件
const delegatedEvents = new MapClass()

// 不会冒泡的事件 参考MDN
const unbubbleEvents = {
  [ONPROPERTYCHANGE]: 1,
  onmousemove: 1,
  ontouchmove: 1,
  onmouseleave: 1,
  onmouseenter: 1,
  onload: 1,
  onunload: 1,
  onscroll: 1,
  onfocus: 1,
  onblur: 1,
  onrowexit: 1,
  onbeforeunload: 1,
  onstop: 1,
  ondragdrop: 1,
  ondragenter: 1,
  ondragexit: 1,
  ondraggesture: 1,
  ondragover: 1,
  oncontextmenu: 1,
  onerror: 1,
  onabort: 1,
  oncanplay: 1,
  oncanplaythrough: 1,
  ondurationchange: 1,
  onemptied: 1,
  onended: 1,
  onloadeddata: 1,
  onloadedmetadata: 1,
  onloadstart: 1,
  onencrypted: 1,
  onpause: 1,
  onplay: 1,
  onplaying: 1,
  onprogress: 1,
  onratechange: 1,
  onseeking: 1,
  onseeked: 1,
  onstalled: 1,
  onsuspend: 1,
  ontimeupdate: 1,
  onvolumechange: 1,
  onwaiting: 1
}

const bindFocus = false
// 给全局命名空间增加Event的定义?
declare global {
  interface Event {
    persist: Function
  }
}

// 为了处理IE9 下 如果执行 backspace 和del 时不会触发input事件 反而触发cut事件
// 问题1： 按键BackSpace / 按键Delete / 拖拽 / 剪切 / 删除，不会触发propertychange和input事件
// addEventListener绑定的propertychange事件任何情况都不会触发，但attachEvent绑定的propertychange事件则在除问题1之外的情况下能够触发。
//
// 判断是否为IE9浏览器
/* istanbul ignore next */
if (isBrowser && navigator.userAgent.indexOf('MSIE 9') >= 0) {
  const elements: HTMLInputElement[] = []
  // input element 对应的value 数组
  const values: string[] = []
  // 在document中绑定事件 selectionchange 是指网页上选定的文本发生更改时触发（涂黑文字）
  doc.addEventListener('selectionchange', () => {
    // DOM中的属性activeElement指向了当前focus的元素(前提是这个元素有onFocus钩子)
    const el = doc.activeElement as HTMLInputElement

    // 如果是Input类型的话
    if (detectCanUseOnInputNode(el)) {
      // 在所有inputelement中找到这个input的index
      const index = elements.indexOf(el)
      // 如果这个元素不存在 就加到所有的input集合中 为什么？？？
      // push的返回值是push进去的值
      const element = elements[index] || elements.push(el)
      // 如果事件值和保存在函数内部的值不一致的话
      if (element.value !== values[index]) {
        // 主动触发input事件
        const ev = doc.createEvent('CustomEvent')
        ev.initCustomEvent('input', true, true, undefined)
        // 更新值
        values[index] = element.value
        el.dispatchEvent(ev)
      }
    }
  })
}

// noop是个空对象 这里是判断如果全局作用域下不存在Event.persist的话就初始化
if (typeof Event !== 'undefined' && !Event.prototype.persist) {
  // tslint:disable-next-line:no-empty
  Event.prototype.persist = noop
}

/**
 * 在节点上绑定事件
 *
 * @export
 * @param {Element} domNode
 * @param {string} eventName
 * @param {Function} handler
 */
export function attachEvent (
  domNode: Element,
  eventName: string,
  handler: Function
) {
  eventName = fixEvent(domNode, eventName) // 处理绑定的事件名称
  /* istanbul ignore next */
  // 如果绑定的事件是 propertychange 有自己的事件处理方式
  if (eventName === ONPROPERTYCHANGE) {
    processOnPropertyChangeEvent(domNode, handler)
    return
  }
  // delegatedEvents就是一个map 从map中查找event
  let delegatedRoots = delegatedEvents.get(eventName)
  // 如果触发的事件是不会冒泡的话
  if (unbubbleEvents[eventName] === 1) {
    // 如果代理的根节点不存在就初始化
    if (!delegatedRoots) {
      delegatedRoots = new MapClass()
    }

    // 在某个节点中触发事件
    const event = attachEventToNode(domNode, eventName, delegatedRoots)
    delegatedEvents.set(eventName, delegatedRoots)
    if (isFunction(handler)) {
      delegatedRoots.set(domNode, {
        eventHandler: handler,
        event
      })
    }
  } else {
    if (!delegatedRoots) {
      delegatedRoots = {
        items: new MapClass()
      }
      delegatedRoots.event = attachEventToDocument(
        doc,
        eventName,
        delegatedRoots
      )
      delegatedEvents.set(eventName, delegatedRoots)
    }
    if (isFunction(handler)) {
      if (isiOS) {
        (domNode as any).onclick = noop
      }
      delegatedRoots.items.set(domNode, handler)
    }
  }
}

export function detachEvent (
  domNode: Element,
  eventName: string,
  handler: Function
) {
  eventName = fixEvent(domNode, eventName)
  if (eventName === ONPROPERTYCHANGE) {
    return
  }
  const delegatedRoots = delegatedEvents.get(eventName)
  if (unbubbleEvents[eventName] === 1 && delegatedRoots) {
    const event = delegatedRoots.get(domNode)
    if (event) {
      domNode.removeEventListener(parseEventName(eventName), event.event, false)
      /* istanbul ignore next */
      const delegatedRootsSize = delegatedRoots.size
      if (delegatedRoots.delete(domNode) && delegatedRootsSize === 0) {
        delegatedEvents.delete(eventName)
      }
    }
  } else if (delegatedRoots && delegatedRoots.items) {
    const items = delegatedRoots.items
    if (items.delete(domNode) && items.size === 0) {
      doc.removeEventListener(
        parseEventName(eventName),
        delegatedRoots.event,
        false
      )
      delegatedEvents.delete(eventName)
    }
  }
}

let propertyChangeActiveElement
let propertyChangeActiveElementValue
let propertyChangeActiveElementValueProp
const propertyChangeActiveHandlers = {}

/* istanbul ignore next */
function propertyChangeHandler (event) {
  if (event.propertyName !== 'value') {
    return
  }
  const target = event.target || event.srcElement
  const val = target.value
  if (val === propertyChangeActiveElementValue) {
    return
  }
  propertyChangeActiveElementValue = val
  const handler = propertyChangeActiveHandlers[target.name]
  if (isFunction(handler)) {
    handler.call(target, event)
  }
}

/* istanbul ignore next */
function processOnPropertyChangeEvent (node, handler) {
  propertyChangeActiveHandlers[node.name] = handler
  if (!bindFocus) {
    // bindFocus = true
    node.addEventListener(
      'focusin',
      () => {
        unbindOnPropertyChange()
        bindOnPropertyChange(node)
      },
      false
    )
    node.addEventListener('focusout', unbindOnPropertyChange, false)
  }
}

/* istanbul ignore next */
function bindOnPropertyChange (node) {
  propertyChangeActiveElement = node
  propertyChangeActiveElementValue = node.value
  propertyChangeActiveElementValueProp = Object.getOwnPropertyDescriptor(
    node.constructor.prototype,
    'value'
  )
  Object.defineProperty(propertyChangeActiveElement, 'value', {
    get () {
      return propertyChangeActiveElementValueProp.get.call(this)
    },
    set (val) {
      propertyChangeActiveElementValue = val
      propertyChangeActiveElementValueProp.set.call(this, val)
    }
  })
  propertyChangeActiveElement.addEventListener(
    'propertychange',
    propertyChangeHandler,
    false
  )
}

/* istanbul ignore next */
function unbindOnPropertyChange () {
  if (!propertyChangeActiveElement) {
    return
  }
  delete propertyChangeActiveElement.value
  propertyChangeActiveElement.removeEventListener(
    'propertychange',
    propertyChangeHandler,
    false
  )

  propertyChangeActiveElement = null
  propertyChangeActiveElementValue = null
  propertyChangeActiveElementValueProp = null
}

// 筛选出input和textarea类型的元素，而且保证会触发input事件
function detectCanUseOnInputNode (node) {
  const nodeName = node.nodeName && node.nodeName.toLowerCase()
  const type = node.type
  return (
    (nodeName === 'input' && /text|password/.test(type)) ||
    nodeName === 'textarea'
  )
}

// 把react的事件名转换为统一的原生事件名
function fixEvent (node: Element, eventName: string) {
  // onDoubleClick 是React 提供的事件名
  if (eventName === 'onDoubleClick') {
    // ondblclick是原生事件
    eventName = 'ondblclick'
  } else if (eventName === 'onTouchTap') {
    eventName = 'onclick'
    // tslint:disable-next-line:prefer-conditional-expression
  } else if (eventName === 'onChange' && detectCanUseOnInputNode(node)) {
    // 查看input类元素的值变动时单观察onInput事件是不够的 参考https://www.cnblogs.com/llguanli/p/7340708.html
    eventName = ONINPUT in window ? ONINPUT : ONPROPERTYCHANGE
  } else {
    // 原生事件名都是小写的
    eventName = eventName.toLowerCase()
  }
  return eventName
}

// 事件名属性是onXXXX 而addEventListener的参数是XXXX，
// 所以去掉前面的on
function parseEventName (name) {
  return name.substr(2)
}
/* istanbul ignore next */

/**
 * 阻止事件冒泡
 *
 */
function stopPropagation () {
  this.cancelBubble = true // 处理IE的阻止冒泡
  this.stopImmediatePropagation() // 处理chrome等的冒泡 与 stopPropagation的差别在于 还会阻止在这个handle后面绑的同级handle的触发。
}

/**
 * React事件代理机制
 *
 * @param {} event
 * @param {*} target
 * @param {*} items
 * @param {*} count
 * @param {*} eventData
 */
function dispatchEvent (event, target, items, count, eventData) {
  const eventsToTrigger = items.get(target)
  if (eventsToTrigger) {
    count--
    eventData.currentTarget = target
    // 添加对原生事件的引用
    // for React synthetic event compatibility
    Object.defineProperties(event, {
      nativeEvent: {
        value: event
      }
    })
    eventsToTrigger(event)
    if (event.cancelBubble) {
      return
    }
  }
  if (count > 0) {
    const parentDom = target.parentNode
    // 不往上冒泡的情况 1. 有阻止冒泡的存在 2. 没有父元素 3. 父元素是节点而且被disabled
    if (
      parentDom === null ||
      (event.type === 'click' && parentDom.nodeType === 1 && parentDom.disabled)
    ) {
      return
    }
    // 递归触发冒泡行为
    dispatchEvent(event, parentDom, items, count, eventData)
  }
}

/**
 * 事件监听 React为了避免绑定的监听器过多导致性能下降 所以在doc下监听事件
 *
 * @param {Document对象} d
 * @param {String} eventName
 * @param { Object } delegatedRoots
 * @returns
 */
function attachEventToDocument (d, eventName, delegatedRoots) {
  const eventHandler = (event) => {
    const items = delegatedRoots.items
    const count = items.size
    if (count > 0) {
      const eventData = {
        currentTarget: event.target
      }
      /* istanbul ignore next */
      try {
        Object.defineProperties(event, {
          currentTarget: {
            configurable: true,
            get () {
              return eventData.currentTarget
            }
          },
          stopPropagation: {
            value: stopPropagation
          }
        })
      } catch (error) {
        // some browsers crashed
        // see: https://stackoverflow.com/questions/44052813/why-cannot-redefine-property
      }
      dispatchEvent(event, event.target, delegatedRoots.items, count, eventData)
    }
  }
  d.addEventListener(parseEventName(eventName), eventHandler, false)
  return eventHandler
}

/**
 * 在节点上绑定事件并把事件通过一个中间层分发到所有的handle中
 * 不会冒泡的事件不会传递到document所以之前的代理方法不管用了
 * @param {Element} node
 * @param {String} eventName
 * @param {Array} delegatedRoots
 * @returns
 */
function attachEventToNode (node, eventName, delegatedRoots) {
  // 中间层
  const eventHandler = (event) => {
    const eventToTrigger = delegatedRoots.get(node)
    if (eventToTrigger && eventToTrigger.eventHandler) {
      const eventData = {
        currentTarget: node
      }
      /* istanbul ignore next */
      Object.defineProperties(event, {
        currentTarget: {
          configurable: true,
          get () {
            return eventData.currentTarget
          }
        }
      })
      eventToTrigger.eventHandler(event)
    }
  }

  // 在节点上绑定事件
  node.addEventListener(parseEventName(eventName), eventHandler, false)
  return eventHandler
}
