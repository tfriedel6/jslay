var jslay = {};
(function() {
    var rules = [];
    var rulesDirty = false;
    var constants = {};

    var elements = [];

    jslay.setConstant = function( name, value ) {
        constants[name] = value;
    };

    jslay.clearConstants = function() {
        constants = {};
    };

    jslay.setRule = function( element, left, top, width, height ) {
        deleteExistingRule( element, 'left' );
        deleteExistingRule( element, 'top' );
        deleteExistingRule( element, 'width' );
        deleteExistingRule( element, 'height' );
        addLayoutRule( element, 'left', left );
        addLayoutRule( element, 'top', top );
        addLayoutRule( element, 'width', width );
        addLayoutRule( element, 'height', height );

        rulesDirty = true;
    };

    jslay.clearRules = function() {
        rules = [];
    };

    jslay.clear = function() {
        rules = [];
        constants = {};
    };

    function findExistingRule( element, property ) {
        for( var i = 0; i < rules.length; i++ ) {
            var rule = rules[i];
            if( rule.element == element && rule.property == property ) {
                return rule;
            }
        }
        return null;
    }

    function deleteExistingRule( element, property ) {
        var result = null;
        for( var i = 0; i < rules.length; i++ ) {
            var rule = rules[i];
            if( rule.element == element && rule.property == property ) {
                result = rule;
                rules.splice( i, 1 );
                i--;
            }
        }
        return result;
    }

    function addLayoutRule( element, property, rule ) {
        rules.push( {
            element: element,
            property: property,
            rule: compile( lex( rule ) ),
            dependencies: null
        } );
    }

    var tokenDefinitions = {
        whitespace: /[ \t]+/,
        element: /#[a-zA-Z_][a-zA-Z0-9_]*/,
        name: /[a-zA-Z_][a-zA-Z0-9_]*/,
        number: /([0-9]+\.?[0-9]*)|([0-9]*\.?[0-9]+)/,
        operator: /[\+\-\*\/\.]/,
        parenthesis: /[\(\)]/
    };

    function lex( expression ) {
        var result = [];
        while( expression.length > 0 ) {
            var found = false;
            for( var type in tokenDefinitions ) {
                if( tokenDefinitions.hasOwnProperty( type ) ) {
                    var regexp = tokenDefinitions[type];
                    var match = regexp.exec( expression );
                    if( match && match.length > 0 && match.index == 0 ) {
                        var matchedString = match[0];
                        if( type != 'whitespace' ) {
                            var value;
                            if( type == 'number' ) {
                                value = Number( matchedString );
                            } else if( type == 'element' ) {
                                value = matchedString.substr( 1 );
                            } else {
                                value = matchedString;
                            }
                            result.push( [ type, value ] );
                        }
                        expression = expression.substring( matchedString.length );
                        found = true;
                        break;
                    }
                }
            }
            if( !found ) {
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

    function compile( tokens ) {
        var expressionStack = [];
        var operatorStack = [];
        for( var i = 0; i < tokens.length; i++ ) {
            var token = tokens[i];
            if( token[0] == 'operator' ) {
                var precedence = findPrecedence( token[1] );
                while( operatorStack.length > 0 && operatorStack[operatorStack.length - 1][0] <= precedence ) {
                    createSubExpression();
                }
                operatorStack.push( [ precedence, token[1] ] );
            } else if( token[0] == 'parenthesis' ) {
                if( token[1] == '(' ) {
                    operatorStack.push( [ operators.length, token[1] ] );
                } else if( token[1] == ')' ) {
                    while( operatorStack.length > 0 && operatorStack[operatorStack.length - 1][1] != '(' ) {
                        createSubExpression();
                    }
                    if( operatorStack.length > 0 ) {
                        operatorStack.pop();
                    }
                }
            } else {
                expressionStack.push( [ 'operand', token ] );
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
            if( operator[1] == '.' ) {
                right[1][0] = 'property';
            }
            var subExpression = [ 'expression', left, operator[1], right ];
            expressionStack.push( subExpression );
        }
    }

    function findPrecedence( operator ) {
        for( var i = 0; i < operators.length; i++ ) {
            if( operators[i].indexOf( operator ) != -1 ) {
                return i;
            }
        }
        return -1;
    }

    function buildRules() {
        if( rulesDirty ) {
            rulesDirty = false;

            for( var i = 0; i < rules.length; i++ ) {
                var element = rules[i].element;
                if( elements.indexOf( element ) == -1 ) {
                    elements.push( element );
                }
                rules[i].dependencies = [];
                findDependencies( rules[i], rules[i].rule );
                rules[i].dependencies = removeDuplicates( rules[i].dependencies );
            }

            sortElementLayoutOrder();
        }
    }

    function findDependencies( rootRule, expression ) {
        if( expression[0] == 'expression' ) {
            if( expression[2] == '.' ) {
                var left = expression[1][1][1];
                var right = expression[3][1][1];
                var properties;
                if( right == 'bottom' ) {
                    properties = [ 'top', 'height' ];
                } else if( right == 'right' ) {
                    properties = [ 'left', 'width' ];
                } else {
                    properties = [ right ];
                }
                for( var i = 0; i < properties.length; i++ ) {
                    var rule = findExistingRule( left, properties[i] );
                    if( rule ) {
                        rootRule.dependencies.push( rule );
                    }
                }
            } else {
                findDependencies( rootRule, expression[1] );
                findDependencies( rootRule, expression[3] );
            }
        }
    }

    function removeDuplicates( array ) {
        var result = [];
        for( var i = 0; i < array.length; i++ ) {
            var element = array[i];
            var exists = false;
            for( var j = 0; j < result.length; j++ ) {
                if( result[j] == element ) {
                    exists = true;
                    break;
                }
            }
            result.push( element );
        }
        return result;
    }

    function sortElementLayoutOrder() {
        var reordered = [];
        for( var i = 0; i < rules.length; i++ ) {
            var rule = rules[i];
            if( reordered.indexOf( rule ) == -1 ) {
                addInOrder( rule, [] );
            }
        }
        rules = reordered;

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

    jslay.layout = function() {
        buildRules();
        var elementPositions = {};
        for( var i = 0; i < elements.length; i++ ) {
            var elementName = elements[i];
            var element = document.getElementById( elementName );
            elementPositions[elementName] = {
                left: element.offsetLeft,
                top: element.offsetTop,
                width: element.offsetWidth,
                height: element.offsetHeight
            };
        }
        for( i = 0; i < rules.length; i++ ) {
            var rule = rules[i];
            elementName = rule.element;
            elementPositions[elementName][rule.property] = run( rule.rule, elementPositions );
        }
        for( i = 0; i < elements.length; i++ ) {
            elementName = elements[i];
            element = document.getElementById( elementName );
            var elementPosition = elementPositions[elementName];
            element.style.left = elementPosition.left + 'px';
            element.style.top = elementPosition.top + 'px';
            element.style.width = elementPosition.width + 'px';
            element.style.height = elementPosition.height + 'px';
        }
    };

    function run( expression, elementPositions ) {
        var expressionType = expression[0];
        if( expressionType == 'expression' ) {
            var left = run( expression[1], elementPositions );
            var operator = expression[2];
            var right = run( expression[3], elementPositions );
            if( operator == '.' ) {
                var elementPosition = elementPositions[left];
                if( elementPosition == null ) {
                    var element = document.getElementById( left );
                    elementPosition = {
                        left: element.offsetLeft,
                        top: element.offsetTop,
                        width: element.offsetWidth,
                        height: element.offsetHeight
                    };
                }
                if( right == 'right' ) {
                    return elementPosition.left + elementPosition.width;
                } else if( right == 'bottom' ) {
                    return elementPosition.top + elementPosition.height;
                } else {
                    return elementPosition[right];
                }
            } else if( operator == '+' ) {
                return left + right;
            } else if( operator == '-' ) {
                return left - right;
            } else if( operator == '*' ) {
                return left * right;
            } else if( operator == '/' ) {
                return left / right;
            }
        } else if( expressionType == 'operand' ) {
            var token = expression[1];
            var tokenType = token[0];
            var result;
            if( tokenType == 'name' ) {
                result = constants[token[1]];
            } else {
                result = token[1];
            }
            return result;
        }
        return null;
    }
})();
