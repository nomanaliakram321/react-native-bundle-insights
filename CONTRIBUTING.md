# Contributing to React Native Bundle Analyzer

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/react-native-bundle-analyzer.git
   cd react-native-bundle-analyzer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

## Development Workflow

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure:
   - Code follows the existing style
   - Tests pass: `npm test`
   - Linting passes: `npm run lint`
   - Build succeeds: `npm run build`

3. Commit your changes:
   ```bash
   git commit -m "Add: description of your changes"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a Pull Request

## Code Style

- We use TypeScript for type safety
- Follow ESLint rules (configured in `.eslintrc.json`)
- Use Prettier for formatting
- Write clear, self-documenting code
- Add comments for complex logic

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Maintain or improve code coverage
- Test both success and error cases

## Pull Request Guidelines

- Keep PRs focused on a single feature/fix
- Update documentation if needed
- Add tests for new functionality
- Describe your changes clearly
- Reference related issues

## Reporting Issues

When reporting bugs, please include:

- Node.js and npm versions
- React Native version
- Steps to reproduce
- Expected vs actual behavior
- Bundle analyzer output/logs

## Feature Requests

We welcome feature requests! Please:

- Check if the feature already exists
- Describe the use case clearly
- Explain why it would be valuable
- Consider contributing it yourself!

## Questions?

Feel free to open an issue for questions or discussions.

Thank you for contributing!
