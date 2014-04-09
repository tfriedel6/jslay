var jslay = {};
(function () {
    var rules = [];
    var rulesDirty = false;
    var constants = {};

    var elements = [];

    jslay.setConstant = function (name, value) {
        constants[name] = value;
    };

    jslay.clearConstants = function () {
        constants = {};
    };

    jslay.setRule = function (element, rules) {
        deleteExistingRule(element, 'left');
        deleteExistingRule(element, 'top');
        deleteExistingRule(element, 'right');
        deleteExistingRule(element, 'bottom');
        deleteExistingRule(element, 'width');
        deleteExistingRule(element, 'height');
        if (rules.left || rules.l) addLayoutRule(element, 'left', rules.left || rules.l);
        if (rules.top || rules.t) addLayoutRule(element, 'top', rules.top || rules.t);
        if (rules.right || rules.r) addLayoutRule(element, 'right', rules.right || rules.r);
        if (rules.bottom || rules.b) addLayoutRule(element, 'bottom', rules.bottom || rules.b);
        if (rules.width || rules.w) addLayoutRule(element, 'width', rules.width || rules.w);
        if (rules.height || rules.h) addLayoutRule(element, 'height', rules.height || rules.h);

        rulesDirty = true;
    };

    jslay.clearRules = function () {
        rules = [];
    };

    jslay.clear = function () {
        rules = [];
        constants = {};
    };

    function findExistingRule(element, property) {
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule.element == element && rule.property == property) {
                return rule;
            }
        }
        return null;
    }

    function deleteExistingRule(element, property) {
        var result = null;
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (rule.element == element && rule.property == property) {
                result = rule;
                rules.splice(i, 1);
                i--;
            }
        }
        return result;
    }

    function addLayoutRule(element, property, rule) {
        rules.push({
            element: element,
            property: property,
            rule: compile(lex(rule)),
            dependencies: null
        });
    }

    var tokenDefinitions = [
        [ 'whitespace', /^[ \t]+/ ],
        [ 'element', /^#[a-zA-Z_]?[a-zA-Z0-9_]*/ ],
        [ 'name', /^[a-zA-Z_][a-zA-Z0-9_]*/ ],
        [ 'number', /^([0-9]+\.?[0-9]*)|([0-9]*\.?[0-9]+)/ ],
        [ 'operator', /^[\+\*\/\.\-]/ ],
        [ 'parenthesis', /^[\(\)]/ ]
    ];

    function lex(expression) {
        var result = [];
        if (expression) {
            while (expression.length > 0) {
                var found = false;
                for (var i = 0; i < tokenDefinitions.length; i++) {
                    var tokenDefinition = tokenDefinitions[i];
                    var type = tokenDefinition[0];
                    var regexp = tokenDefinition[1];
                    var match = regexp.exec(expression);
                    if (match && match.length > 0 && match.index == 0) {
                        var matchedString = match[0];
                        if (type != 'whitespace') {
                            var value;
                            if (type == 'number') {
                                value = Number(matchedString);
                            } else if (type == 'element') {
                                value = matchedString.substr(1);
                            } else {
                                value = matchedString;
                            }
                            result.push([ type, value ]);
                        }
                        expression = expression.substring(matchedString.length);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return null;
                }
            }
        }
        return result;
    }

    var operators = [
        [ '.' ],
        [ '*', '/' ],
        [ '+', '-' ]
    ];

    function compile(tokens) {
        var expressionStack = [];
        var operatorStack = [];
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (token[0] == 'operator') {
                var precedence = findPrecedence(token[1]);
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1][0] <= precedence) {
                    createSubExpression();
                }
                operatorStack.push([ precedence, token[1] ]);
            } else if (token[0] == 'parenthesis') {
                if (token[1] == '(') {
                    operatorStack.push([ operators.length, token[1] ]);
                } else if (token[1] == ')') {
                    while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1][1] != '(') {
                        createSubExpression();
                    }
                    if (operatorStack.length > 0) {
                        operatorStack.pop();
                    }
                }
            } else {
                expressionStack.push([ 'operand', token ]);
            }
        }
        while (operatorStack.length > 0) {
            createSubExpression();
        }
        return expressionStack.pop();

        function createSubExpression() {
            var operator = operatorStack.pop();
            var right = expressionStack.pop();
            var left = expressionStack.pop();
            if (operator[1] == '.') {
                right[1][0] = 'property';
            }
            var subExpression = [ 'expression', left, operator[1], right ];
            expressionStack.push(subExpression);
        }
    }

    function findPrecedence(operator) {
        for (var i = 0; i < operators.length; i++) {
            if (operators[i].indexOf(operator) != -1) {
                return i;
            }
        }
        return -1;
    }

    function buildRules() {
        if (rulesDirty) {
            rulesDirty = false;

            for (var i = 0; i < rules.length; i++) {
                var element = rules[i].element;
                if (elements.indexOf(element) == -1) {
                    elements.push(element);
                }
                rules[i].dependencies = [];
                findDependencies(rules[i], rules[i].rule);
                rules[i].dependencies = removeDuplicates(rules[i].dependencies);
            }

            sortElementLayoutOrder();
        }
    }

    function findDependencies(rootRule, expression) {
        if (!expression) return;
        if (expression[0] == 'expression') {
            if (expression[2] == '.') {
                var left = expression[1][1][1];
                var right = expression[3][1][1];
                var properties;
                if (right == 'bottom') {
                    properties = [ 'top', 'height' ];
                } else if (right == 'right') {
                    properties = [ 'left', 'width' ];
                } else {
                    properties = [ right ];
                }
                for (var i = 0; i < properties.length; i++) {
                    var rule = findExistingRule(left, properties[i]);
                    if (rule) {
                        rootRule.dependencies.push(rule);
                    }
                }
            } else {
                findDependencies(rootRule, expression[1]);
                findDependencies(rootRule, expression[3]);
            }
        }
    }

    function removeDuplicates(array) {
        var result = [];
        for (var i = 0; i < array.length; i++) {
            var element = array[i];
            var exists = false;
            for (var j = 0; j < result.length; j++) {
                if (result[j] == element) {
                    exists = true;
                    break;
                }
            }
            result.push(element);
        }
        return result;
    }

    function sortElementLayoutOrder() {
        var reordered = [];
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (reordered.indexOf(rule) == -1) {
                addInOrder(rule, []);
            }
        }
        rules = reordered;

        function addInOrder(rule, elementStack) {
            for (var j = 0; j < elementStack.length; j++) {
                if (rule.element == elementStack[j][0] && rule.property == elementStack[j][1]) {
                    return;
                }
            }
            if (rule.dependencies.length > 0) {
                elementStack.push([rule.element, rule.property]);
                for (j = 0; j < rule.dependencies.length; j++) {
                    addInOrder(rule.dependencies[j], elementStack);
                }
                elementStack.pop();
            }
            reordered.push(rule);
        }
    }

    jslay.layout = function () {
        var elementPositions = jslay.getLayout();
        jslay.applyLayout(elementPositions);
    };

    jslay.getLayout = function () {
        buildRules();
        var elementPositions = {};
        for (var i = 0; i < elements.length; i++) {
            var elementName = elements[i];
            var element = document.getElementById(elementName);
            elementPositions[elementName] = getElementPos(element);
        }
        for (i = 0; i < rules.length; i++) {
            var rule = rules[i];
            elementName = rule.element;
            if (!elementPositions[elementName].fromRules) {
                elementPositions[elementName].fromRules = {};
            }
            elementPositions[elementName].fromRules[rule.property] = true;
        }
        for (i = 0; i < rules.length; i++) {
            rule = rules[i];
            elementName = rule.element;
            var elementPosition = elementPositions[elementName];
            if (rule.rule) {
                elementPosition[rule.property] = run(rule.rule, elementPositions, elementName);
                if (rule.property == 'left') {
                    if (!elementPosition.fromRules['width']) elementPosition.width = elementPosition.right - elementPosition.left;
                    if (!elementPosition.fromRules['right']) elementPosition.right = elementPosition.left + elementPosition.width;
                } else if (rule.property == 'width') {
                    if (!elementPosition.fromRules['left']) elementPosition.left = elementPosition.right - elementPosition.width;
                    if (!elementPosition.fromRules['right']) elementPosition.right = elementPosition.left + elementPosition.width;
                } else if (rule.property == 'right') {
                    if (!elementPosition.fromRules['left']) elementPosition.left = elementPosition.right - elementPosition.width;
                    if (!elementPosition.fromRules['width']) elementPosition.width = elementPosition.right - elementPosition.left;
                } else if (rule.property == 'top') {
                    if (!elementPosition.fromRules['height']) elementPosition.height = elementPosition.bottom - elementPosition.top;
                    if (!elementPosition.fromRules['bottom']) elementPosition.bottom = elementPosition.top + elementPosition.height;
                } else if (rule.property == 'height') {
                    if (!elementPosition.fromRules['top']) elementPosition.top = elementPosition.bottom - elementPosition.height;
                    if (!elementPosition.fromRules['bottom']) elementPosition.bottom = elementPosition.top + elementPosition.height;
                } else if (rule.property == 'bottom') {
                    if (!elementPosition.fromRules['top']) elementPosition.top = elementPosition.bottom - elementPosition.height;
                    if (!elementPosition.fromRules['height']) elementPosition.height = elementPosition.bottom - elementPosition.top;
                }
            } else {
                element = document.getElementById(elementName);
                if (rule.property == 'width') {
                    elementPosition['width'] = element.offsetWidth;
                    elementPosition['selfWidth'] = true;
                } else if (rule.property == 'height') {
                    elementPosition['height'] = element.offsetHeight;
                    elementPosition['selfHeight'] = true;
                }
            }
        }
        return elementPositions;
    };

    jslay.applyLayout = function (elementPositions) {
        for (var i = 0; i < elements.length; i++) {
            var elementName = elements[i];
            var element = document.getElementById(elementName);
            var elementPosition = elementPositions[elementName];
            element.style.left = elementPosition.left + 'px';
            element.style.top = elementPosition.top + 'px';
            if (!elementPositions[elementName]['selfWidth']) {
                element.style.width = elementPosition.width + 'px';
            }
            if (!elementPositions[elementName]['selfHeight']) {
                element.style.height = elementPosition.height + 'px';
            }
        }
    };

    function run(expression, elementPositions, thisElement) {
        if (!expression) return;
        var expressionType = expression[0];
        if (expressionType == 'expression') {
            var left = run(expression[1], elementPositions, thisElement);
            var operator = expression[2];
            var right = run(expression[3], elementPositions, thisElement);
            if (operator == '.') {
                var elementPosition = elementPositions[left == '' ? thisElement : left];
                if (elementPosition == null) {
                    var element = document.getElementById(left);
                    elementPosition = getElementPos(element);
                }
                if (right == 'l') right = 'left';
                else if (right == 'r') right = 'right';
                else if (right == 't') right = 'top';
                else if (right == 'b') right = 'bottom';
                else if (right == 'w') right = 'width';
                else if (right == 'h') right = 'height';
                return elementPosition[right];
            } else if (operator == '+') {
                return left + right;
            } else if (operator == '-') {
                return left - right;
            } else if (operator == '*') {
                return left * right;
            } else if (operator == '/') {
                return left / right;
            }
        } else if (expressionType == 'operand') {
            var token = expression[1];
            var tokenType = token[0];
            var result;
            if (tokenType == 'name') {
                result = constants[token[1]];
            } else {
                result = token[1];
            }
            return result;
        }
        return null;
    }

    function getElementPos(element) {
        return {
            left: element.offsetLeft,
            top: element.offsetTop,
            width: element.offsetWidth,
            height: element.offsetHeight,
            right: element.offsetLeft + element.offsetWidth,
            bottom: element.offsetTop + element.offsetHeight
        };
    }
})();
