import h from './vdom/h'
import { isFunction, isString, isUndefined } from 'nerv-utils'
import FullComponent from './full-component'
import StatelessComponent from './stateless-component'
import CurrentOwner from './current-owner'
import {
  Props,
  Component,
  VNode,
  VirtualChildren,
  EMPTY_CHILDREN
} from 'nerv-shared'
import SVGPropertyConfig from './vdom/svg-property-config'

/**
 * 把传入的属性转换为可以直接用的属性
 *
 * @param {string} type 参数不会被用到
 * @param {Props} props
 * @returns
 */
function transformPropsForRealTag (type: string, props: Props) {
  const newProps: Props = {}
  for (const propName in props) {
    const propValue = props[propName]
    if (propName === 'defaultValue') { // 如果有defaultValue那就有对应的Value属性
      newProps.value = props.value || props.defaultValue
      continue
    }
    const svgPropName = SVGPropertyConfig.DOMAttributeNames[propName]
    if (svgPropName && svgPropName !== propName) {
      newProps[svgPropName] = propValue
      continue
    }
    newProps[propName] = propValue
  }
  return newProps
}

/**
 *
 * @param props
 * @param defaultProps
 * defaultProps should respect null but ignore undefined
 * @see: https://facebook.github.io/react/docs/react-component.html#defaultprops
 */
function transformPropsForComponent (props: Props, defaultProps?: Props) {
  const newProps: any = {}
  for (const propName in props) {
    const propValue = props[propName]
    newProps[propName] = propValue
  }
  if (defaultProps) {
    for (const propName in defaultProps) {
      if (isUndefined(newProps[propName])) {
        newProps[propName] = defaultProps[propName]
      }
    }
  }
  return newProps
}

/**
 * 把Component转化为对应的VNode
 *
 * @template T
 * @param {(string | Function | Component<any, any>)} type
 * @param {(T & Props | null)} [properties]
 * @param {(...Array<VirtualChildren | null>)} _children
 * @returns
 */
function createElement<T> (
  type: string | Function | Component<any, any>,
  properties?: T & Props | null,
  ..._children: Array<VirtualChildren | null>
) {
  let children: any = _children
  if (_children) {
    if (_children.length === 1) {
      children = _children[0]
    } else if (_children.length === 0) {
      children = undefined
    }
  }
  let props
  if (isString(type)) {
    props = transformPropsForRealTag(type, properties as Props)
    props.owner = CurrentOwner.current
    return h(type, props, children as any) as VNode
  } else if (isFunction(type)) {
    props = transformPropsForComponent(
      properties as any,
      (type as any).defaultProps
    )
    if (!props.children || props.children === EMPTY_CHILDREN) {
      props.children = children || children === 0 ? children : EMPTY_CHILDREN
    }
    props.owner = CurrentOwner.current
    return type.prototype && type.prototype.render // 如果有render方法说明传入的是一个类
      ? new FullComponent(type, props) // 完整的状态组件
      : new StatelessComponent(type, props) // 无状态组件没有render方法，直接返回了JSX
  }
  return type
}

export default createElement
