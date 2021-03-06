import {
  log, isString, isUrl, isNumber, isArray, isFunction, isObject, includes, printStrArr,
  anyOf, isPresent,
} from '../utils';
import {
  id, url, handler, version, AnyOf, Context, Action, Resource, Subject, Environment, Rule,
  RuleHandler, Policy, PolicySet, Obligation, Advice,
} from '../interfaces';
import {
  Effect, Effects, CombiningAlgorithm, CombiningAlgorithms, HttpMethod, HttpMethods,
} from '../constants';
import { Language } from '../classes/language';
import { Settings } from '../settings';
import { Singleton } from './singleton';

// TODO: Get rid of npm's valid-url. // Why was this?
export class Bootstrap extends Singleton {
  private static readonly tag: string = 'Bootstrap';

  private static readonly normalizeString = (v: string): string =>
    isString(v) ? v : null

  public static readonly normalizeUrl = (v: url): string =>
    isUrl(v) ? v : null

  private static readonly normalizeBoolean = (v: boolean): boolean =>
    v === true ? true : false

  private static readonly normalizeObject = (v: any): any =>
    isObject(v) ? v : null

  private static readonly normalizeId = (id: id): id =>
    isNumber(id) || isString(id) ? id : null

  private static readonly getId = (element: Subject | Resource | Rule | Policy | PolicySet | Obligation | Advice | RuleHandler, type: string, errors: Error[]): id => {
    const id: id = Bootstrap.normalizeId(element.id);
    if (!id) errors.push(TypeError(`${type} #${id} (useful, I know) has an invalid id (${element.id}). Must either be a number or a string.`));
    return id;
  }


  private static readonly normalizeVersion = (version: version): version =>
    isString(version) || isNumber(version) ? version : null

  private static readonly getVersion = (element: Rule | Policy | PolicySet | Obligation | Advice | RuleHandler, type: string, errors: Error[]): version => {
    const version: version = Bootstrap.normalizeVersion(element.version);
    if (!version) errors.push(TypeError(`${type} #${element.id} has an invalid version (${element.version}). Must either be a number or a string.`));
    return version;
  }


  private static readonly normalizeEffect = (effect: Effect): Effect =>
    includes(Effects, effect) ? effect : null

  private static readonly getEffect = (element: Rule | Obligation | Advice, type: string, errors: Error[]): Effect => {
    const effect: Effect = Bootstrap.normalizeEffect(element.effect);
    if (!effect) errors.push(TypeError(`${type} #${element.id} has an invalid Effect (${element.effect}). Must be one of: ${printStrArr(Effects)}.`));
    return effect;
  }


  private static readonly getDescription = (element: Rule | Policy | PolicySet | Obligation | Advice | RuleHandler, type: string, errors: Error[]): string => {
    const description: string = Bootstrap.normalizeString(element.description);
    return description;
  }

  // string -> AnyOf[] | null
  private static readonly stringToAnyOfArr = (target: any): AnyOf[] =>
    isString(target) ? [[[target]]] : null

  // AllOf -> AnyOf[] | null
  private static readonly allOfToAnyOffArr = (target: any): AnyOf[] =>
    isArray(target) && target.every(isString) ? [[target]] : null

  // AnyOf -> AnyOf[] | null
  private static readonly anyOfToAnyOffArr = (target: any): AnyOf[] =>
    isArray(target) && target.every(Bootstrap.allOfToAnyOffArr) ? [target] : null

  // TODO: Passes because empty array. Check [0] element.
  // AnyOf[] -> AnyOf[] | null
  private static readonly anyOfArrToAnyOffArr = (target: any): AnyOf[] =>
    isArray(target) && target.every(Bootstrap.anyOfToAnyOffArr) ? target : null

  // any -> AnyOf[] | null
  private static readonly normalizeAnyOffArr = (target: any): AnyOf[] =>
    Bootstrap.anyOfArrToAnyOffArr(target) || Bootstrap.anyOfToAnyOffArr(target) ||
    Bootstrap.allOfToAnyOffArr(target) || Bootstrap.stringToAnyOfArr(target)

  public static readonly getTarget = (element: Rule | Policy | PolicySet, type: string, errors: Error[]): AnyOf[] => {
    const target: AnyOf[] = Bootstrap.normalizeAnyOffArr(element.target);
    if (!target) errors.push(TypeError(`${type} #${element.id} has an invalid target (${element.target}). Must either be a string, AllOf, AnyOf or AnyOf[].`));
    return target;
  }


  private static readonly getCondition = (element: Rule, errors: Error[]): AnyOf[] => {
    const condition: AnyOf[] = Bootstrap.normalizeAnyOffArr(element.condition);
    if (!condition) errors.push(TypeError(`Rule #${element.id} has an invalid condition (${element.condition}). Must either be a string, AllOf, AnyOf or AnyOf[]`));
    return condition;
  }


  private static readonly normalizeCombiningAlgorithm = (combiningAlgorithm: CombiningAlgorithm): CombiningAlgorithm =>
    includes(CombiningAlgorithms, combiningAlgorithm) ? combiningAlgorithm : null

  private static readonly getCombiningAlgorithm = (element: Policy | PolicySet, type: string, errors: Error[]): CombiningAlgorithm => {
    const combiningAlgorithm: CombiningAlgorithm = Bootstrap.normalizeCombiningAlgorithm(element.combiningAlgorithm);
    if (!combiningAlgorithm) errors.push(TypeError(`${type} #${element.id} has an invalid CombiningAlgorithm (${element.combiningAlgorithm}). Must be one of: ${printStrArr(CombiningAlgorithms)}.`));
    if (combiningAlgorithm === CombiningAlgorithm.OnlyOneApplicable && type !== 'PolicySet') errors.push(TypeError(`${type} #${element.id} has an invalid combiningAlgorithm (${element.combiningAlgorithm}). CombiningAlgorithm '${CombiningAlgorithm[CombiningAlgorithm.OnlyOneApplicable]}' is only applicable to a PolicySet.`));
    return combiningAlgorithm;
  }


  private static readonly getIds = (element: Rule | Policy | PolicySet | Obligation | Advice, key: string, type: string, errors: Error[]): id[] => {
    const ids: id[] = (element[key] || []).map(Bootstrap.normalizeId);
    if (ids.some(id => !id)) errors.push(TypeError(`${type} ${element.id} has invalid ${element[key]}. Must be a (number | string)[].`));
    return ids;
  }


  private static readonly getUrls = (element: Rule | Policy | PolicySet | Obligation | Advice, key: string, type: string, errors: Error[]): url[] => {
    const urls: url[] = (element[key] || []).map(Bootstrap.normalizeUrl);
    if (urls.some(url => !url)) errors.push(TypeError(`${type} ${element.id} has invalid ${element[key]}. Must be an url[] (pass npm's 'valid-url').`));
    return urls;
  }


  private static readonly normalizeHandler = (handler: handler): handler => {
    const tag: string = `${Bootstrap.tag}.normalizeHandler()`;
    // log(tag, 'handler:', handler);
    return isFunction(handler) || isString(handler) /* isUrl(handler) */ ? handler : null;
  }

  private static readonly getHandler = (element: Obligation | Advice | RuleHandler, type: string, errors: Error[]): handler => {
    const handler: handler = Bootstrap.normalizeHandler(element.handler);
    if (!handler) errors.push(TypeError(`${type} #${element.id} has an invalid handler (${element.handler}). Must either be a Function or an url (pass npm's 'valid-url').`));
    return handler;
  }


  private static readonly normalizeHttpMethod = (httpMethod: HttpMethod): HttpMethod =>
    includes(HttpMethods, httpMethod) ? httpMethod : null

  private static readonly getHttpMethod = (element: Action, type: string, errors: Error[]): HttpMethod => {
    const httpMethod: HttpMethod = Bootstrap.normalizeHttpMethod(element.method);
    if (!httpMethod) errors.push(TypeError(`${type} has an invalid HttpMethod (${element.method}). Must be one of: ${printStrArr(HttpMethods)}.`));
    return httpMethod;
  }


  private static readonly normalizeAttributeMap = (attributeMap: any): any =>
    isObject(attributeMap) ? attributeMap : null

  private static readonly getAttributeMap = (element: RuleHandler | Obligation | Advice, type: string, errors: Error[]): any => {
    const attributeMap: any = Bootstrap.normalizeAttributeMap(element.attributeMap);
    if (!attributeMap) errors.push(TypeError(`${type} #${element.id} has an invalid attributeMap (${element.attributeMap}). Must be an object.`));
    return attributeMap;
  }


  public static readonly getRuleHandler = (element: RuleHandler, errors: Error[]): RuleHandler => {
    const tag: string = `${Bootstrap.tag}.getRuleHandler()`;
    if (Settings.Bootstrap.debug) console.log(tag);
    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'RuleHandler', errors),
      version: Bootstrap.getVersion(element, 'RuleHandlers', errors),
      description: Bootstrap.getDescription(element, 'RuleHandlers', errors),
      handler: Bootstrap.getHandler(element, 'RuleHandler', errors),
      attributeMap: !element.attributeMap ? null : Bootstrap.getAttributeMap(element, 'RuleHandler', errors),
    });
  }


  public static readonly getAction = (element: Action, errors: Error[]): Action => {
    const tag: string = `${Bootstrap.tag}.getAction()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    return Object.assign({}, element, {
      method: Bootstrap.getHttpMethod(element, 'Action', errors),
      // TODO:
      operation: Bootstrap.normalizeString(element.operation),
    });
  }


  public static readonly getResource = (element: Resource, errors: Error[]): Resource => {
    const tag: string = `${Bootstrap.tag}.getResource()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'Resource', errors),
    });
  }


  public static readonly getSubject = (element: Subject, errors: Error[]): Subject => {
    const tag: string = `${Bootstrap.tag}.getSubject()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    return Object.assign({}, element, {
      // Unauthenticated user.
      id: !isPresent(element.id) ? null : Bootstrap.getId(element, 'Subject', errors),
    });
  }


  public static readonly getEnvironment = (element: Environment, errors: Error[]): Environment => {
    const tag: string = `${Bootstrap.tag}.getEnvironment()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    return Object.assign({}, element, {
      // Placeholder.
    });
  }

  public static readonly getContext = (element: Context, errors: Error[]): Context => {
    const tag: string = `${Bootstrap.tag}.getContext()`;
    if (Settings.Bootstrap.debug) console.log(tag);
    // return Object.assign({}, element, {
    return Object.assign(element, {
      returnReason: Bootstrap.normalizeBoolean(element.returnReason),
      returnPolicyList: Bootstrap.normalizeBoolean(element.returnPolicyList),
      returnAdviceResults: Bootstrap.normalizeBoolean(element.returnAdviceResults),
      returnObligationResults: Bootstrap.normalizeBoolean(element.returnObligationResults),
      action: Bootstrap.getAction(element.action, errors),
      resource: Bootstrap.getResource(element.resource, errors),
      subject: Bootstrap.getSubject(element.subject, errors),
      environment: Bootstrap.getEnvironment(element.environment, errors),
      policyList: [],
      adviceResults: [],
      obligationResults: [],
    });
  }

  public static readonly getRule = (element: any, errors: Error[]): Rule => {
    const tag: string = `${Bootstrap.tag}.getRule()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    const target: AnyOf[] = !element.target ? null : Bootstrap.getTarget(element, 'Rule', errors);
    if (target) {
      const targetErrors: Error[] = [];
      Language.anyOfArrToQueries(target, targetErrors);
      if (targetErrors.length) errors.push(Error(`Rule #${element.id} has an invalid target: ${printStrArr(targetErrors, '\n')}.`));
    }

    const condition: AnyOf[] = !element.condition ? null : Bootstrap.getCondition(element, errors);
    if (condition) {
      const conditionErrors: Error[] = [];
      Language.anyOfArrToQueries(condition, conditionErrors);
      if (conditionErrors.length) errors.push(Error(`Rule #${element.id} has an condition: ${printStrArr(conditionErrors, '\n')}.`));
    }

    const ruleHandlerDefined: boolean = isPresent(element.handlerId);
    const handlerId: id = !ruleHandlerDefined ? null : Bootstrap.normalizeId(element.handlerId);
    if (condition && ruleHandlerDefined) errors.push(Error(`Rule #${element.id} has both the condition (${element.condition}) and handlerId (${element.handlerId}) defined.`));

    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'Rule', errors),
      version: Bootstrap.getVersion(element, 'Rule', errors),
      effect: Bootstrap.getEffect(element, 'Rule', errors),
      description: Bootstrap.getDescription(element, 'Rule', errors),
      target,
      condition,
      handlerId,
      // TODO: Maybe can keep these to null so there's no unnecessary debug information in the Pep.
      obligationIds: Bootstrap.getIds(element, 'obligationIds', 'Rule', errors),
      adviceIds: Bootstrap.getIds(element, 'adviceIds', 'Rule', errors),
    });
  }

  public static readonly getPolicy = (element: Policy, errors: Error[]): Policy => {
    const tag: string = `${Bootstrap.tag}.getPolicy()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    const target: AnyOf[] = !element.target ? null : Bootstrap.getTarget(element, 'Policy', errors);
    if (target) {
      const targetErrors: Error[] = [];
      Language.anyOfArrToQueries(target, targetErrors);
      if (targetErrors.length) errors.push(Error(`Policy #${element.id} has an invalid target: ${printStrArr(targetErrors, '\n')}.`));
    }

    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'Policy', errors),
      version: Bootstrap.getVersion(element, 'Policy', errors),
      combiningAlgorithm: Bootstrap.getCombiningAlgorithm(element, 'Policy', errors),
      // maxDelegationDepth?: number;
      description: Bootstrap.getDescription(element, 'Policy', errors),
      target,
      // issuer?: string;
      // defaults?: any;
      // combinerParameters: any;
      // ruleCombinerParameters: any;
      // variableDefinition: any;
      // TODO: Maybe can keep these to null so there's no unnecessary debug information in the Pep.
      ruleIds: Bootstrap.getIds(element, 'ruleIds', 'Policy', errors),
      ruleUrls: Bootstrap.getUrls(element, 'ruleUrls', 'Policy', errors),
      obligationIds: Bootstrap.getIds(element, 'obligationIds', 'Policy', errors),
      adviceIds: Bootstrap.getIds(element, 'adviceIds', 'Policy', errors),
    });
  }


  public static readonly getPolicySet = (element: PolicySet, errors: Error[]): PolicySet => {
    const tag: string = `${Bootstrap.tag}.getPolicySet()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    const target: AnyOf[] = !element.target ? null : Bootstrap.getTarget(element, 'PolicySet', errors);
    if (target) {
      const targetErrors: Error[] = [];
      Language.anyOfArrToQueries(target, targetErrors);
      if (targetErrors.length) errors.push(Error(`PolicySet #${element.id} has an invalid target: ${printStrArr(targetErrors, '\n')}.`));
    }

    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'PolicySet', errors),
      version: Bootstrap.getVersion(element, 'PolicySet', errors),
      combiningAlgorithm: Bootstrap.getCombiningAlgorithm(element, 'PolicySet', errors),
      // maxDelegationDepth?: number;
      description: Bootstrap.getDescription(element, 'PolicySet', errors),
      target,
      // issuer?: string;
      // defaults?: any;
      // TODO: Maybe can keep these to null so there's no unnecessary debug information in the Pep.
      policySetIds: Bootstrap.getIds(element, 'policySetIds', 'PolicySet', errors),
      policySetUrls: Bootstrap.getUrls(element, 'policySetUrls', 'PolicySet', errors),
      policyIds: Bootstrap.getIds(element, 'policyIds', 'PolicySet', errors),
      policyUrls: Bootstrap.getUrls(element, 'policyUrls', 'PolicySet', errors),
      obligationIds: Bootstrap.getIds(element, 'obligationIds', 'PolicySet', errors),
      adviceIds: Bootstrap.getIds(element, 'adviceIds', 'PolicySet', errors),
      // combinerParameters: any;
      // policyCombinerParameters: any;
      // policySetCombinerParameters: any;
    });
  }


  public static readonly getObligation = (element: Obligation, errors: Error[]): Obligation => {
    const tag: string = `${Bootstrap.tag}.getObligation()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'Obligation', errors),
      version: !isPresent(element.version) ? null : Bootstrap.getVersion(element, 'Obligation', errors),
      description: Bootstrap.getDescription(element, 'Obligation', errors),
      // Effect upon which the obligation MUST be fulfilled. Allow to be omitted for both Effects.
      effect: !element.effect ? null : Bootstrap.getEffect(element, 'Obligation', errors),
      handler: Bootstrap.getHandler(element, 'Obligation', errors),
      attributeMap: !element.attributeMap ? null : Bootstrap.getAttributeMap(element, 'Obligation', errors),
    });
  }


  public static readonly getAdvice = (element: Advice, errors: Error[]): Advice => {
    const tag: string = `${Bootstrap.tag}.getAdvice()`;
    if (Settings.Bootstrap.debug) console.log(tag, 'element:\n', element);
    return Object.assign({}, element, {
      id: Bootstrap.getId(element, 'Advice', errors),
      version: !isPresent(element.version) ? null : Bootstrap.getVersion(element, 'Advice', errors),
      description: Bootstrap.getDescription(element, 'Advice', errors),
      // Effect upon which the advice MAY be fulfilled. Allow to be omitted for both Effects.
      effect: !element.effect ? null : Bootstrap.getEffect(element, 'Advice', errors),
      handler: Bootstrap.getHandler(element, 'Advice', errors),
      attributeMap: !element.attributeMap ? null : Bootstrap.getAttributeMap(element, 'Advice', errors),
    });
  }
}
