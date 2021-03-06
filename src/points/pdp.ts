import {
  log, retrieveElement, isPresent, isBoolean, isFunction, isString, includes,
  evaluateHandler, isRule, isPolicy, isPolicySet, printStrArr, flatten, unique,
} from '../utils';
import {
  id, version, url, Context, RuleHandler, Rule, Policy, PolicySet, Obligation, Advice,
  CustomCombiningAlgorithm, AnyOf, AllOf,
} from '../interfaces';
import {
  Effect, CombiningAlgorithm, Decision, CombiningAlgorithms, Indeterminate, XACMLElement,
} from '../constants';
import { Singleton } from '../classes/singleton';
import { Bootstrap } from '../classes/bootstrap';
import { Language } from '../classes/language';
import { Request } from '../classes/request';
import { Settings } from '../settings';
import { Prp } from './prp';
import { Pip } from './pip';

export interface AttributeMapContainer {
  version: version;
  attributeMap: any;
}

// Should've been target [[[]]]
// Pdp.evaluateTarget() element: { id: 'SimplePolicy1',
//   version: '1.0',
//   combiningAlgorithm: 'DenyOverrides',
//   description: 'Medi Corp access control policy.',
//   target: [],
//   ruleIds: [ 'SimpleRule1' ],
//   ruleUrls: [],
//   obligationIds: [],
//   adviceIds: [] }
// Pdp.evaluateTarget() target: []
// Pdp.evaluateAnyOfArr() anyOfArr: []
// Pdp.evaluateTarget() targetValue: true
// Pdp.combineDecision() targetMatch: true


// TODO: Check what happens with the null id and target (wrapped set?).
// TODO: Allow to add priority policies/handlers, to run before any applicable policies (check IP or whatever).
// TODO: Add Indeterminate(DP, D, P)?
// TODO: Cache in the future.
export class Pdp extends Singleton {
  private static readonly tag: string = 'Pdp';

  private static bootstrapped: boolean = false;

  private static readonly ruleHandlerMap = {};
  private static readonly customCombiningAlgorithmMap = {};

  private static readonly ruleTargetAttributeMaps = {};
  private static readonly ruleConditionAttributeMaps = {};

  private static readonly policyTargetAttributeMaps = {};
  private static readonly policySetTargetAttributeMaps = {};

  // Multiple element accessors which MUST be defined by the end user.
  public static _retrieveRuleHandlers = () => retrieveElement('RuleHandlers', '_retrieveRuleHandlers', 'Pdp');
  public static _retrieveCustomCombiningAlgorithms = () => retrieveElement('CustomCombiningAlgorithms', '_retrieveCustomCombiningAlgorithms', 'Pdp');

  private static async retrieveRuleHandlers(): Promise<any[]> {
    const tag: string = `${Pdp.tag}.retrieveRuleHandlers()`;
    const request: Promise<any> = Pdp._retrieveRuleHandlers();
    return request;
  }

  private static async retrieveCustomCombiningAlgorithms(): Promise<any[]> {
    const tag: string = `${Pdp.tag}.retrieveCustomCombiningAlgorithms()`;
    const request: Promise<any> = Pdp._retrieveCustomCombiningAlgorithms();
    return request;
  }
  //

  public static getRuleHandlerById(id: id): RuleHandler {
    const tag: string = `${Pdp.tag}.getRuleHandlerById()`;
    const ruleHandler: RuleHandler = Pdp.ruleHandlerMap[id];
    return ruleHandler;
  }

  public static getCustomCombiningAlgorithmById(id: id): CustomCombiningAlgorithm {
    const tag: string = `${Pdp.tag}.getCustomCombiningAlgorithmById()`;
    const customCombiningAlgorithm: CustomCombiningAlgorithm = Pdp.customCombiningAlgorithmMap[id];
    return customCombiningAlgorithm;
  }

  public static async bootstrap(): Promise<boolean> {
    const tag: string = `${Pdp.tag}.bootstrap()`;
    if (Settings.Pdp.debug) console.log(tag);
    const errors: Error[] = [];
    Pdp.bootstrapped = false;

    try {
      (await Pdp.retrieveRuleHandlers()).forEach(_ruleHandler => {
        const ruleHandler: RuleHandler = Bootstrap.getRuleHandler(_ruleHandler, errors);
        if (isPresent(ruleHandler.id)) Pdp.ruleHandlerMap[ruleHandler.id] = ruleHandler;
      });
    } catch (err) {
      errors.push(err);
    }

    // if (Settings.Pdp.debug) log(tag, 'ruleHandlerMap:', Pdp.ruleHandlerMap);

    if (errors.length) throw `${errors.join('\n')}`;

    Pdp.bootstrapped = true;

    return Pdp.bootstrapped;
  }

  // TODO: Act on errors.
  public static retrieveTargetAttributeMap(element: Rule | Policy | PolicySet, attributeMaps: any): any {
    const tag: string = `${Pdp.tag}.retrieveTargetAttributeMap()`;
    const container: AttributeMapContainer = attributeMaps[element.id];
    // if (Settings.Pdp.debug) log(tag, 'container:', container);

    if (container && container.version === element.version) return container.attributeMap;

    const targetQueryErrors: Error[] = [];
    attributeMaps[element.id] = {
      version: element.version,
      attributeMap: Language.anyOfArrToFlatAttributeMap(element.target, targetQueryErrors),
    };
    // if (Settings.Pdp.debug) log(tag, `attributeMaps['${element.id}']:`, attributeMaps[element.id]);
    return attributeMaps[element.id].attributeMap;
  }

  // TODO: Act on errors.
  public static retrieveRuleConditionAttributeMap(element: Rule): any {
    const tag: string = `${Pdp.tag}.retrieveRuleConditionAttributeMap()`;
    const container: AttributeMapContainer = Pdp.ruleConditionAttributeMaps[element.id];
    if (container && container.version === element.version) return container.attributeMap;

    const conditionQueryErrors: Error[] = [];
    Pdp.ruleConditionAttributeMaps[element.id] = {
      version: element.version,
      attributeMap: Language.anyOfArrToFlatAttributeMap(element.condition, conditionQueryErrors),
    };
    return Pdp.ruleConditionAttributeMaps[element.id].attributeMap;
  }

  public static async EvaluateDecisionRequest(context: Context): Promise<Decision> {
    const tag: string = `${Pdp.tag}.EvaluateDecisionRequest()`;
    if (!Pdp.bootstrapped) throw Error(`Pdp has not been bootstrapped.`);
    if (Settings.Pdp.debug) log(tag, 'context:', context);
    const contextQueries: string[] = Language.retrieveContextQueries(context);
    if (Settings.Pdp.debug) log(tag, 'contextQueries:', contextQueries);
    const errors: Error[] = [];
    const policies: Policy[] = await Prp.retrieveContextPolicies(contextQueries, errors);
    const policySets: PolicySet[] = await Prp.retrieveContextPolicySets(contextQueries, errors);
    if (errors.length) throw errors;

    const policySet: PolicySet = {
      id: null,
      version: null,
      target: null,
      combiningAlgorithm: Settings.Pdp.combiningAlgorithm,
      policies,
      policySets,
    };
    if (Settings.Pdp.debug) log(tag, 'policySet:', policySet);
    const decision: Decision = context.decision = await Pdp.combineDecision(context, policySet);
    if (Settings.Pdp.debug) log(tag, 'decision:', decision);
    return decision;
  }

  // TODO: Does the combining algorithm has to be passed down?
  public static async combineDecision(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.combineDecision()`;
    if (Settings.Pdp.debug) log(tag, 'context:\n', context);
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: boolean = isPolicy(element);

    // The containing policySet doesn't have an id.
    if (element.id) {
      const targetAttributeMap: any = policy ?
        Pdp.retrieveTargetAttributeMap(element, Pdp.policyTargetAttributeMaps) :
        Pdp.retrieveTargetAttributeMap(element, Pdp.policySetTargetAttributeMaps);
      if (Settings.Pdp.debug) log(tag, 'targetAttributeMap:', targetAttributeMap);

      const missingTargetAttributes: string[] = await Pip.retrieveAttributes(context, targetAttributeMap);
      if (missingTargetAttributes.length) {
        if (Settings.Pdp.debug) log(tag, `Couldn't evaluate ${policy ? 'Policy' : 'PolicySet'} #${element.id} target. Evaluating ${policy ? 'Policy' : 'PolicySet'} to ${Decision[Decision.Indeterminate]}. Unretrieved attributes: ${printStrArr(missingTargetAttributes, '\n')}.`);
        return Decision.Indeterminate;
      }

      const targetMatch: boolean | Decision = Pdp.evaluateTarget(context, element);
      if (Settings.Pdp.debug) log(tag, 'targetMatch:', targetMatch);
      if (targetMatch === Decision.Indeterminate) return Decision.Indeterminate;
      if (!targetMatch) return Decision.NotApplicable;
    }

    let decision: Decision;
    if (includes(CombiningAlgorithms, combiningAlgorithm)) {
      if (combiningAlgorithm === CombiningAlgorithm.DenyOverrides) decision = await Pdp.denyOverrides(context, element);
      if (combiningAlgorithm === CombiningAlgorithm.PermitOverrides) decision = await Pdp.permitOverrides(context, element);
      if (combiningAlgorithm === CombiningAlgorithm.DenyUnlessPermit) decision = await Pdp.denyUnlessPermit(context, element);
      if (combiningAlgorithm === CombiningAlgorithm.PermitUnlessDeny) decision = await Pdp.permitUnlessDeny(context, element);
      if (combiningAlgorithm === CombiningAlgorithm.PermitOverrides) decision = await Pdp.permitOverrides(context, element);
      if (combiningAlgorithm === CombiningAlgorithm.FirstApplicable) decision = await Pdp.firstApplicable(context, element);
      if (combiningAlgorithm === CombiningAlgorithm.OnlyOneApplicable) decision = await Pdp.onlyOneApplicable(context, element);
    } else {
      const customCombiningAlgorithm: CustomCombiningAlgorithm = Pdp.getCustomCombiningAlgorithmById(combiningAlgorithm);
      if (customCombiningAlgorithm) {
        customCombiningAlgorithm.handler(context, element, Pdp.combineDecision, Pdp.evaluateRule);
      } else {
        if (Settings.Pdp.debug) log(tag, `${policy ? 'Policy' : 'PolicySet'} #${element.id} contains an invalid combiningAlgorithm (${combiningAlgorithm}). Evaluating to ${Decision[Decision.Indeterminate]}.`);
        return Decision.Indeterminate;
      }
    }

    if (element.id) {
      // Using an array because the same element and element set could be evaluated
      // multiple times with different targets and decisions.
      context.policyList = [...context.policyList, { policy: element, decision }];
    }

    return decision;
  }

  public static async denyOverrides(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.denyOverrides()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: Policy = isPolicy(element) ? element : null;
    const policySet: PolicySet = policy === null ? element : null;

    let deny: boolean = false;
    let indeterminate: boolean = false;
    let permit: boolean = false;

    if (policySet) {
      for (const policy of [...policySet.policies, ...policySet.policySets]) {
        if (deny) return Decision.Deny;
        const decision: Decision = await Pdp.combineDecision(context, policy);
        deny = decision === Decision.Deny;
        if (!indeterminate) indeterminate = decision === Decision.Indeterminate;
        if (!permit) permit = decision === Decision.Permit;
      }
    } else {
      for (const rule of policy.rules) {
        if (deny) return Decision.Deny;
        const decision: Decision = await Pdp.evaluateRule(context, rule);
        deny = decision === Decision.Deny;
        if (!indeterminate) indeterminate = decision === Decision.Indeterminate;
        if (!permit) permit = decision === Decision.Permit;
      }
    }

    if (deny) return Decision.Deny;
    if (indeterminate) return Decision.Indeterminate;
    if (permit) return Decision.Permit;
    return Decision.NotApplicable;
  }

  public static async permitOverrides(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.permitOverrides()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: Policy = isPolicy(element) ? element : null;
    const policySet: PolicySet = policy === null ? element : null;

    let permit: boolean = false;
    let indeterminate: boolean = false;
    let deny: boolean = false;

    if (policySet) {
      for (const policy of [...policySet.policies, ...policySet.policySets]) {
        if (permit) return Decision.Permit;
        const decision: Decision = await Pdp.combineDecision(context, policy);
        permit = decision === Decision.Permit;
        if (!indeterminate) indeterminate = decision === Decision.Indeterminate;
        if (!permit) permit = decision === Decision.Permit;
      }
    } else {
      for (const rule of policy.rules) {
        if (permit) return Decision.Permit;
        const decision: Decision = await Pdp.evaluateRule(context, rule);
        permit = decision === Decision.Permit;
        if (!indeterminate) indeterminate = decision === Decision.Indeterminate;
        if (!permit) permit = decision === Decision.Permit;
      }
    }

    if (permit) return Decision.Permit;
    if (indeterminate) return Decision.Indeterminate;
    if (deny) return Decision.Deny;
    return Decision.NotApplicable;
  }

  public static async denyUnlessPermit(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.denyUnlessPermit()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: Policy = isPolicy(element) ? element : null;
    const policySet: PolicySet = policy === null ? element : null;

    let permit: boolean = false;
    if (policySet) {
      for (const policy of [...policySet.policies, ...policySet.policySets]) {
        if (permit) return Decision.Permit;
        const decision: Decision = await Pdp.combineDecision(context, policy);
        permit = decision === Decision.Permit;
      }
    } else {
      for (const rule of policy.rules) {
        if (permit) return Decision.Permit;
        const decision: Decision = await Pdp.evaluateRule(context, rule);
        permit = decision === Decision.Permit;
      }
    }

    if (permit) return Decision.Permit;
    return Decision.Deny;
  }

  public static async permitUnlessDeny(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.permitUnlessDeny()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: Policy = isPolicy(element) ? element : null;
    const policySet: PolicySet = policy === null ? element : null;

    let deny: boolean = false;
    if (policySet) {
      for (const policy of [...policySet.policies, ...policySet.policySets]) {
        if (deny) return Decision.Deny;
        const decision: Decision = await Pdp.combineDecision(context, policy);
        deny = decision === Decision.Deny;
      }
    } else {
      for (const rule of policy.rules) {
        if (deny) return Decision.Deny;
        const decision: Decision = await Pdp.evaluateRule(context, rule);
        deny = decision === Decision.Deny;
      }
    }

    if (deny) return Decision.Deny;
    return Decision.Permit;
  }

  public static async firstApplicable(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.firstApplicable()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: Policy = isPolicy(element) ? element : null;
    const policySet: PolicySet = policy === null ? element : null;

    let decision: Decision = Decision.NotApplicable;
    if (policySet) {
      for (const policy of [...policySet.policies, ...policySet.policySets]) {
        if (decision !== Decision.NotApplicable) return decision;
        decision = await Pdp.combineDecision(context, policy);
      }
    } else {
      for (const rule of policy.rules) {
        if (decision !== Decision.NotApplicable) return decision;
        decision = await Pdp.evaluateRule(context, rule);
      }
    }
    return Decision.NotApplicable;
  }

  public static async onlyOneApplicable(context: Context, element: Policy | PolicySet,
    combiningAlgorithm: CombiningAlgorithm = element.combiningAlgorithm): Promise<Decision> {
    const tag: string = `${Pdp.tag}.onlyOneApplicable()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    const policy: Policy = isPolicy(element) ? element : null;
    const policySet: PolicySet = policy === null ? element : null;

    let indeterminate: boolean = false;
    let result: Decision = Decision.NotApplicable;

    // Usable only on PolicySet. Allow to use on rules (in Policy)?
    // if (policySet) {
    for (const policy of [...policySet.policies, ...policySet.policySets]) {
      if (indeterminate) return Decision.Indeterminate;
      const decision: Decision = await Pdp.combineDecision(context, policy);
      indeterminate = decision === Decision.Indeterminate ||
        // The current decision AND a previous decision is something other
        // than NotApplicable (return Indeterminate).
        decision !== Decision.NotApplicable && result !== Decision.NotApplicable;
      result = decision;
    }
    // } else {
    //   for (const rule of policy.rules) {
    //     if (indeterminate) return Decision.Indeterminate;
    //     const decision: Decision = await Pdp.evaluateRule(context, rule);
    //     indeterminate = decision === Decision.Indeterminate ||
    //       // The current decision AND a previous decision is something other
    //       // than NotApplicable (return Indeterminate).
    //       decision !== Decision.NotApplicable && result !== Decision.NotApplicable;
    //     result = decision;
    //   }
    // }

    if (indeterminate) return Decision.Indeterminate;
    return result;
  }

  public static async evaluateRule(context: Context, element: Rule): Promise<Effect | Decision> {
    const tag: string = `${Pdp.tag}.evaluateRule()`;
    if (Settings.Pdp.debug) log(tag, 'element:\n', element);

    const targetAttributeMap: any = Pdp.retrieveTargetAttributeMap(element, Pdp.ruleTargetAttributeMaps);
    if (Settings.Pdp.debug) log(tag, 'targetAttributeMap:', targetAttributeMap);
    const missingTargetAttributes: string[] = await Pip.retrieveAttributes(context, targetAttributeMap);
    if (missingTargetAttributes.length) {
      if (Settings.Pdp.debug) log(tag, `Couldn't evaluate Rule #${element.id} target. Evaluating Rule to ${Decision[Decision.Indeterminate]}. Unretrieved attributes: ${printStrArr(missingTargetAttributes, '\n')}.`);
      return Decision.Indeterminate;
    }

    const targetMatch: boolean | Decision = Pdp.evaluateTarget(context, element);
    if (Settings.Pdp.debug) log(tag, 'targetMatch:', targetMatch);
    if (targetMatch === Decision.Indeterminate) return Decision.Indeterminate;
    if (!targetMatch) return Decision.NotApplicable;

    const ruleHandlerDefined: boolean = isPresent(element.handlerId);
    if (element.condition && ruleHandlerDefined) {
      if (Settings.Pdp.debug) log(tag, `Rule #${element.id} has both the condition and handlerId defined. Evaluating Rule to ${Decision[Decision.Indeterminate]}.`);
      return Decision.Indeterminate;
    }

    let conditionAttributeMap: any;
    let ruleHandler: RuleHandler;
    if (element.condition) {
      conditionAttributeMap = Pdp.retrieveRuleConditionAttributeMap(element);
    } else if (ruleHandlerDefined) {
      ruleHandler = Pdp.getRuleHandlerById(element.handlerId);
      if (!ruleHandler) {
        if (Settings.Pdp.debug) log(tag, `Rule #${element.id} RuleHandler #${element.handlerId} is not registered with the Pdp. Evaluating Rule to ${Decision[Decision.Indeterminate]}.`);
        return Decision.Indeterminate;
      }
      conditionAttributeMap = ruleHandler.attributeMap;
    } else {
      // Rule has no condition or ruleHandler defined.
      conditionAttributeMap = null;
    }

    if (Settings.Pdp.debug) log(tag, 'conditionAttributeMap:', conditionAttributeMap);
    if (conditionAttributeMap) {
      const missingConditionAttributes: string[] = await Pip.retrieveAttributes(context, conditionAttributeMap);
      if (missingConditionAttributes.length) {
        if (Settings.Pdp.debug) log(tag, `Couldn't evaluate Rule #${element.id} ${ruleHandlerDefined ? 'RuleHandler #' + element.handlerId : 'condition'}. Evaluating Rule to ${Decision[Decision.Indeterminate]}. Unretrieved attributes: ${printStrArr(missingConditionAttributes, '\n')}.`);
        return Decision.Indeterminate;
      }
    }

    const decision: boolean | Decision = !element.condition && !ruleHandlerDefined ? true :
      element.condition ? Pdp.evaluateCondition(context, element) :
        await evaluateHandler(context, ruleHandler, 'RuleHandler', Pip);
    if (Settings.Pdp.debug) log(tag, 'decision:', decision);

    let effect: Effect | Decision;
    if (decision === true) effect = element.effect;
    else if (decision === false) effect = Decision.NotApplicable;
    else effect = Decision.Indeterminate;
    if (Settings.Pdp.debug) log(tag, 'effect:', effect);

    return effect;
  }

  public static evaluateTarget(context: Context, element: Rule | Policy | PolicySet): boolean | Decision {
    const tag: string = `${Pdp.tag}.evaluateTarget()`;
    // if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    if (Settings.Pdp.debug) log(tag, 'target:', element.target);
    const targetValue: boolean | Decision = Pdp.evaluateAnyOfArr(context, element.target);
    if (Settings.Pdp.debug) log(tag, 'targetValue:', targetValue);
    return targetValue;
  }

  public static evaluateCondition(context: Context, element: Rule): boolean | Decision {
    const tag: string = `${Pdp.tag}.evaluateCondition()`;
    // if (Settings.Pdp.debug) log(tag, 'element:\n', element);
    if (Settings.Pdp.debug) log(tag, 'condition:', element.condition);
    const conditionValue: boolean | Decision = Pdp.evaluateAnyOfArr(context, element.condition);
    if (Settings.Pdp.debug) log(tag, 'conditionValue:', conditionValue);
    return conditionValue;
  }

  public static evaluateAnyOfArr(context: Context, anyOfArr: AnyOf[]): boolean | Decision {
    const tag: string = `${Pdp.tag}.evaluateAnyOfArr()`;
    if (Settings.Pdp.debug) log(tag, 'anyOfArr:', anyOfArr);
    for (const anyOf of anyOfArr) {
      if (Settings.Pdp.debug) log(tag, 'anyOf:', anyOf);
      const anyOfValue: boolean | Decision = Pdp.evaluateAnyOf(context, anyOf);
      if (Settings.Pdp.debug) log(tag, 'anyOfValue:', anyOfValue);
      if (!anyOfValue || anyOfValue === Decision.Indeterminate) return anyOfValue;
    }
    return true;
  }

  public static evaluateAnyOf(context: Context, anyOf: AnyOf): boolean | Decision {
    const tag: string = `${Pdp.tag}.evaluateAnyOf()`;
    if (Settings.Pdp.debug) log(tag, 'anyOf:', anyOf);
    for (const allOf of anyOf) {
      if (Settings.Pdp.debug) log(tag, 'allOf:', allOf);
      const allOfValue: boolean | Decision = Pdp.evaluateAllOf(context, allOf);
      if (Settings.Pdp.debug) log(tag, 'allOfValue:', allOfValue);
      if (!allOfValue || allOfValue === Decision.Indeterminate) return allOfValue;
    }
    return true;
  }

  public static evaluateAllOf(context: Context, allOf: AllOf): boolean | Decision {
    const tag: string = `${Pdp.tag}.evaluateAllOf()`;
    if (Settings.Pdp.debug) log(tag, 'allOf:', allOf);
    for (const expression of allOf) {
      if (Settings.Pdp.debug) log(tag, 'expression:', expression);
      const expressionValue: boolean | Decision = Pdp.expressionToDecision(context, expression);
      if (Settings.Pdp.debug) log(tag, 'expressionValue:', expressionValue);
      if (!expressionValue || expressionValue === Decision.Indeterminate) return expressionValue;
    }
    return true;
  }

  public static expressionToDecision(context: Context, str: string): boolean | Decision {
    const tag: string = `${Pdp.tag}.expressionToDecision()`;
    const expression: string = Language.strToExpression(context, str);
    if (expression === Decision.Indeterminate) {
      if (Settings.Pdp.error) log(tag, `Could not evaluate the expression (${str}). Evaluating expression value to ${Decision[Decision.Indeterminate]}.`);
      return Decision.Indeterminate;
    }

    if (Settings.Pdp.debug) log(tag, 'expression:', expression);
    let value: boolean;
    try {
      value = eval(expression);
      if (!isBoolean(value)) {
        // Only allow the expression to evaluate to true or false.
        if (Settings.Pdp.debug) log(tag, 'Truncated expression value from:', value);
        value = !!value;
        if (Settings.Pdp.debug) log(tag, 'To boolean value:', value);
      }
    } catch (err) {
      if (Settings.Pdp.error) log(tag, `Could not execute the expression (${expression}). Evaluating expression value to ${Decision[Decision.Indeterminate]}.`);
      return Decision.Indeterminate;
    }
    if (Settings.Pdp.debug) log(tag, 'value:', value);
    return value;
  }
}