# Global Cursor Rules

## Development Standards

You are an expert in Solidity, TypeScript, Node.js, Next.js 14 App Router, React, Vite, Viem v2, Wagmi v2, Shadcn UI, Radix UI, and Tailwind CSS.

## Key Principles

- Write concise, technical responses with accurate TypeScript examples
- Use functional, declarative programming. Avoid classes
- Prefer iteration and modularization over duplication
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError)
- Use lowercase with dashes for directories (e.g., components/auth-wizard)
- Favor named exports for components
- Use the Receive an Object, Return an Object (RORO) pattern

## JavaScript/TypeScript

- Use "function" keyword for pure functions. Omit semicolons
- Use TypeScript for all code. Prefer interfaces over types
- Avoid enums; use maps instead
- File structure: Exported component, subcomponents, helpers, static content, types
- Avoid unnecessary curly braces in conditional statements
- For single-line statements in conditionals, omit curly braces
- Use concise, one-line syntax for simple conditional statements (e.g., `if (condition) doSomething()`)
- Use strict mode in TypeScript for better type safety

## Error Handling and Validation

Prioritize error handling and edge cases:

- Handle errors and edge cases at the beginning of functions
- Use early returns for error conditions to avoid deeply nested if statements
- Place the happy path last in the function for improved readability
- Avoid unnecessary else statements; use if-return pattern instead
- Use guard clauses to handle preconditions and invalid states early
- Implement proper error logging and user-friendly error messages
- Consider using custom error types or error factories for consistent error handling
- Use Zod for runtime validation and error handling
- Model expected errors as return values: Avoid using try/catch for expected errors in Server Actions
- Use error boundaries for unexpected errors: Implement error boundaries using error.tsx and global-error.tsx files

## React/Next.js

- Use functional components and TypeScript interfaces
- Use declarative JSX
- Use function, not const, for components
- Use Shadcn UI, Radix UI, and Tailwind CSS for components and styling
- Implement responsive design with Tailwind CSS
- Use mobile-first approach for responsive design
- Place static content and interfaces at file end
- Use content variables for static content outside render functions
- Minimize 'use client', 'useEffect', and 'setState'. Favor React Server Components (RSC)
- Wrap client components in Suspense with fallback
- Use dynamic loading for non-critical components
- Optimize images: WebP format, size data, lazy loading
- Use useActionState with react-hook-form for form validation
- Code in services/ dir always throw user-friendly errors that can be caught and shown to the user
- Use next-safe-action for all server actions:
  - Implement type-safe server actions with proper validation
  - Utilize the `action` function from next-safe-action for creating actions
  - Define input schemas using Zod for robust type checking and validation
  - Handle errors gracefully and return appropriate responses
  - Use `import type { ActionResponse } from '@/types/actions'`
  - Ensure all server actions return the ActionResponse type
  - Implement consistent error handling and success responses

## Web3 Integration (Viem v2, Wagmi v2)

- Use Viem v2 for low-level Ethereum interactions
- Use Wagmi v2 hooks for React integration
- Implement proper error handling for blockchain transactions
- Handle network switching and wallet connection states gracefully
- Use proper type safety with Viem's TypeScript types
- Implement transaction status tracking and user feedback

## State Management

- Use React Context and useReducer for managing global state
- Leverage React Query (tanStack Query) for data fetching and caching
- Avoid excessive API calls; implement proper caching strategies
- For complex state management, consider using Zustand or Redux Toolkit
- Handle URL search parameters using libraries like next-usequerystate

## Performance Optimization

- Minimize the use of useState and useEffect; prefer context and reducers
- Implement code splitting and lazy loading for non-critical components
- Profile and monitor performance using React DevTools
- Avoid unnecessary re-renders by memoizing components and using useMemo and useCallback hooks appropriately
- Prioritize Web Vitals (LCP, CLS, FID)
- Use React Server Components for data fetching when possible
- Implement the preload pattern to prevent waterfalls

## Component Structure

- Break down components into smaller parts with minimal props
- Suggest micro folder structure for components
- Use composition to build complex components
- Follow the order: component declaration, styled components (if any), TypeScript types
- Keep components focused on a single responsibility

## Styling

- Use Tailwind CSS for styling, following the Utility First approach
- Utilize the Class Variance Authority (CVA) for managing component variants
- Implement dark mode support using Tailwind's dark mode classes
- Ensure high accessibility (a11y) standards using ARIA roles and semantic HTML
- Use responsive design with Tailwind's breakpoint system

## Testing

- Write unit tests using Jest and React Testing Library
- Implement integration tests for critical user flows
- Use snapshot testing for components to ensure UI consistency
- Test error handling and edge cases thoroughly

## Security

- Sanitize user inputs to prevent XSS attacks
- Use secure storage for sensitive data
- Ensure secure communication with APIs using HTTPS and proper authentication
- Validate all inputs on both client and server side
- Implement proper CORS policies

## Accessibility

- Ensure interfaces are keyboard navigable
- Implement proper ARIA labels and roles for components
- Ensure color contrast ratios meet WCAG standards for readability
- Test with screen readers and keyboard navigation

## Key Conventions

1. Rely on Next.js App Router for state changes and routing
2. Prioritize Web Vitals (LCP, CLS, FID)
3. Minimize 'use client' usage:
   - Prefer server components and Next.js SSR features
   - Use 'use client' only for Web API access in small components
   - Avoid using 'use client' for data fetching or state management
4. Follow the monorepo structure if applicable:
   - Place shared code in appropriate directories
   - Keep app-specific code organized
5. Adhere to the defined database schema and use enum tables for predefined values

## Naming Conventions

- Booleans: Use auxiliary verbs such as 'does', 'has', 'is', and 'should' (e.g., isDisabled, hasError)
- Filenames: Use lowercase with dash separators (e.g., auth-wizard.tsx)
- File extensions: Use .config.ts, .test.ts, .context.tsx, .type.ts, .hook.ts as appropriate

## Documentation

- Provide clear and concise comments for complex logic
- Use JSDoc comments for functions and components to improve IDE intellisense
- Keep the README files up-to-date with setup instructions and project overview
- Document API endpoints, data schemas, and complex business logic

## File Length & Modularity

All source files must be under 300 lines of code (including comments and whitespace).

### Principles

- **Single Purpose**: Each file serves one purpose (e.g. registry mgmt, CLI parsing, tool integration)
- **Modular Exports**: Break logic into small, reusable functions or classes
- **Split on Growth**: If approaching 300 LOC, refactor into sub-modules
- **Separate Concerns**: File I/O, prompting, and validation must be in distinct modules

### Enforcement

- All `.ts`, `.tsx`, `.js`, `.jsx` files must be ≤ 300 lines
- Files exceeding this limit must be refactored into smaller modules
- Each module should have a single, clear responsibility
- Related functionality should be grouped in subdirectories

## References

- Next.js documentation for Data Fetching, Rendering, and Routing best practices
- Vercel AI SDK documentation for AI integration
- Viem v2 documentation for Ethereum interactions
- Wagmi v2 documentation for React Web3 hooks
- Shadcn UI documentation for component usage
- Radix UI documentation for accessible primitives
