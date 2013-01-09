var jslay = {};
(function () {
    jslay.rules = [];
    var rulesDirty = false;

    jslay.add = function (element, left, top, width, height) {
        if (typeof( element ) == 'string') {
            var id = element;
            element = document.getElementById(id);
        }
        element.style.position = 'absolute';

        addLayoutRule(element, 'left', left);
        addLayoutRule(element, 'top', top);
        addLayoutRule(element, 'width', width);
        addLayoutRule(element, 'height', height);

        rulesDirty = true;
    };

    function addLayoutRule(element, property, rule) {
        jslay.rules.push({
            element: element,
            property: property,
            rule: compile(lex(rule)),
            dependencies: null
        });
    }

    var tokenDefinitions = {
        whitespace: /[ \t]+/,
        element: /#[a-zA-Z_][a-zA-Z0-9_]*/,
        name: /[a-zA-Z_][a-zA-Z0-9_]*/,
        number: /([0-9]+\.?[0-9]*)|([0-9]*\.?[0-9]+)/,
        operator: /[\+\-\*\/\.]/
    };

    function lex(expression) {
        var result = [];
        while (expression.length > 0) {
            var found = false;
            for (var type in tokenDefinitions) {
                if (tokenDefinitions.hasOwnProperty(type)) {
                    var regexp = tokenDefinitions[type];
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
            }
            if (!found) {
                return null;
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
                if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1][0] <= precedence) {
                    createSubExpression();
                }
                operatorStack.push([ precedence, token[1] ]);
            } else {
                expressionStack.push([ 'operand', token ]);
            }
        }
        while( operatorStack.length > 0 ) {
            createSubExpression();
        }
        return expressionStack.pop();

        function createSubExpression() {
            var operator = operatorStack.pop();
            var right = expressionStack.pop();
            var left = expressionStack.pop();
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

    jslay.buildRules = function() {
        if( rulesDirty ) {
            rulesDirty = false;

            for( var i = 0; i < jslay.rules.length; i++ ) {
                jslay.rules[i].dependencies = [];
                findDependencies(jslay.rules[i], jslay.rules[i].rule);
                jslay.rules[i].dependencies = removeDuplicates(jslay.rules[i].dependencies);
            }

            sortElementLayoutOrder();
        }
    };

    function findDependencies(rootRule, expression) {
        if(expression[0] == 'expression') {
            if(expression[2] == '.') {
                var left = run( expression[1] );
                var right = run( expression[3] );
                for( var i = 0; i < jslay.rules.length; i++ ) {
                    var rule = jslay.rules[i];
                    if( rule.element == left && rule.property == right ) {
                        rootRule.dependencies.push(rule);
                        break;
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
        for( var i = 0; i < jslay.rules.length; i++ ) {
            var rule = jslay.rules[i];
            var exists = false;
            for( var j = 0; j < reordered.length; j++ ) {
                if( reordered[j] == rule ) {
                    exists = true;
                    break;
                }
            }
            if( !exists ) {
                addInOrder( rule, [] );
            }
        }
        jslay.rules = reordered;

        function addInOrder( rule, elementStack ) {
            for( var j = 0; j < elementStack.length; j++ ) {
                if( rule.element == elementStack[j] ) {
                    return;
                }
            }
            if( rule.dependencies.length > 0 ) {
                elementStack.push( rule.element );
                for( j = 0; j < rule.dependencies.length; j++ ) {
                    addInOrder( rule.dependencies[j], elementStack );
                }
                elementStack.pop();
            }
            reordered.push( rule );
        }
    }

    jslay.layout = function () {
        jslay.buildRules();
        for (var i = 0; i < jslay.rules.length; i++) {
            var rule = jslay.rules[i];
            var element = rule.element;
            var result = run(rule.rule);
            element.style[rule.property] = result + 'px';
        }
    };

    function run(expression) {
        var expressionType = expression[0];
        if (expressionType == 'expression') {
            var left = run(expression[1]);
            var operator = expression[2];
            var right = run(expression[3]);
            if (operator == '.') {
                if (right == 'left') {
                    return left.offsetLeft;
                } else if (right == 'width') {
                    return left.offsetWidth;
                } else if (right == 'top') {
                    return left.offsetTop;
                } else if (right == 'height') {
                    return left.offsetHeight;
                }
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
            if (tokenType == 'element') {
                result = document.getElementById(token[1]);
            } else {
                result = token[1];
            }
            return result;
        }
        return null;
    }
})();
