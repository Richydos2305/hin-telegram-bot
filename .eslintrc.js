module.exports = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  ignorePatterns: ['coverage/block-navigation.js'],
  extends: [
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'plugin:prettier/recommended',
    'prettier',
    // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors.
    // Make sure this is always the last configuration in the extends array.
    'plugin:prettier/recommended'
  ],
  plugins: ['@typescript-eslint', 'prettier', 'import'],
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    project: './tsconfig.json'
  },
  rules: {
    'comma-style': ['error', 'last'], // requires a comma after and on the same line as an array element, object property, or variable declaration
    'comma-dangle': ['error', 'never'], // disallow trailing commas
    'no-use-before-define': [
      // warns when it encounters a reference to an identifier that has not yet been declared.
      'error',
      {
        functions: true,
        classes: true,
        variables: false
      }
    ],
    'arrow-return-shorthand': 0,
    'max-len': ['error', { code: 300 }],
    semi: ['error', 'always'],
    indent: ['error', 2],
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    'import/prefer-default-export': 'off'
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': ['error']
      }
    },
    {
      files: ['src/core/models/*.ts', 'src/core/models_new/*.ts'],
      rules: {
        'no-use-before-define': 'off'
      }
    }
  ],
  ignorePatterns: []
};
