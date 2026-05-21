# Development Standards Documentation

This directory contains comprehensive development standards and best practices for building modern applications.

## 📋 Available Standards

### 1. [Web Application Standards](./web-app-standards.mdc)

**Technology**: React + TypeScript + shadcn/ui + Tailwind CSS  
**Use Cases**:

- Single-page applications (SPA)
- Admin dashboards and management interfaces
- Data-driven web applications
- Enterprise web portals

**Key Topics**:

- React 18+ with hooks and functional components
- Redux Toolkit state management
- shadcn/ui component library (Radix UI primitives)
- Tailwind CSS utility-first styling
- Service layer architecture
- Security best practices
- Performance optimization

**Related Files**:

- [`styles.mdc`](./styles.mdc) - Detailed styling rules, colors, component specs

---

### 2. [API Server Standards](./api-server-standards.mdc)

**Technology**: Node.js + Express + TypeScript + MySQL  
**Use Cases**:

- RESTful API servers
- Backend microservices
- Authentication services
- Database-driven applications
- Business logic layer

**Key Topics**:

- Layered architecture (Routes → Services → Database)
- JWT authentication and authorization
- Zod validation patterns
- Database connection pooling and transactions
- Security best practices (SQL injection prevention, rate limiting)
- Error handling strategies
- Testing strategies (unit and integration)

---

### 3. [Electron Application Standards](./electron-app-standards.mdc)

**Technology**: Electron + TypeScript + Node.js  
**Use Cases**:

- Cross-platform desktop applications
- Multi-monitor display systems
- Hardware device integration (HID, USB, Serial)
- Kiosk applications
- Local server applications

**Key Topics**:

- Secure IPC communication patterns
- Multi-window and multi-display management
- Hardware device integration
- Native module handling
- Application lifecycle management
- Build and packaging strategies

---

## 🎯 How to Use These Standards

### For AI Assistants (Cursor, GitHub Copilot, etc.)

Add the relevant standard file to your AI context:

```
// In your .cursorrules or similar
@include .cursor/rules/web-app-standards.mdc
@include .cursor/rules/electron-app-standards.mdc
```

### For Human Developers

1. **Onboarding**: Read the relevant standard document from start to finish
2. **Reference**: Keep open while coding for quick lookups
3. **Code Review**: Use as checklist for PR reviews
4. **Architecture Decisions**: Consult before making significant changes

### For Project Setup

Copy the relevant `.mdc` file to your project:

```bash
# For web projects
cp web-app-standards.mdc your-project/.cursor/rules/

# For Electron projects
cp electron-app-standards.mdc your-project/.cursor/rules/

# Update paths in your project's documentation
```

---

## 📚 Document Structure

Each standard document follows this structure:

1. **Context & Purpose** - What this document covers and who it's for
2. **Technology Stack** - Complete list of technologies and versions
3. **Project Structure** - Recommended folder organization
4. **Architectural Patterns** - Core design patterns with examples
5. **Design System** (Web only) - UI/UX standards and components
6. **Security Architecture** (Electron only) - Security best practices
7. **Coding Standards** - TypeScript, ESLint, Prettier configurations
8. **Best Practices** - DO's and DON'Ts with examples
9. **Testing Strategy** - Testing approaches and examples
10. **Security Checklist** - Security requirements
11. **Critical Rules Summary** - Must-follow rules
12. **Command Reference** - Common CLI commands

---

## 🔧 Customization Guide

### Adapting for Your Project

These standards are designed to be **framework-agnostic at the pattern level**. To adapt:

1. **Keep**: Architectural patterns, security principles, testing strategies
2. **Replace**: Specific libraries (e.g., MUI → Ant Design, Redux → Zustand)
3. **Add**: Project-specific conventions, domain logic patterns

### Example Customizations

#### Using Different UI Framework

```markdown
// Original (shadcn/ui + Tailwind)

- **Primary UI Framework**: shadcn/ui (Radix UI primitives)
- **Utility CSS**: Tailwind CSS v3+

// Customized (Ant Design)

- **Primary UI Framework**: Ant Design v5+
- Follow Ant Design design tokens
- Use `ConfigProvider` for theming
```

#### Using Different State Management

```markdown
// Original (Redux Toolkit)

- **Global State**: Redux Toolkit

// Customized (Zustand)

- **Global State**: Zustand
- Create stores in `src/stores/`
- Use hooks: `useStore()`
```

#### Using Different Database

```markdown
// Original (MySQL)

- **Database**: MySQL with mysql2 driver

// Customized (PostgreSQL)

- **Database**: PostgreSQL with pg driver
- Update connection pool configuration
- Adjust query syntax for PostgreSQL
```

---

## 🚀 Prompt Engineering Techniques Applied

These documents leverage advanced prompt engineering techniques:

### 1. **Chain of Thought (CoT)**

- Step-by-step reasoning in architectural patterns
- Explained decision-making process

### 2. **Few-Shot Learning**

- Multiple code examples for each pattern
- ✅ Good vs ❌ Bad comparisons

### 3. **Structured Prompting**

- Clear hierarchy with headers and subsections
- Consistent formatting across sections

### 4. **Role Assignment**

- Explicit target audience definition
- Context-setting at document start

### 5. **Constraint Specification**

- Clear ALWAYS/NEVER rules
- Security checklists

### 6. **Self-Consistency**

- Multiple examples reinforcing same principles
- Cross-references between sections

---

## 📊 Document Metrics

| Document              | Lines | Topics | Code Examples | Checklists |
| --------------------- | ----- | ------ | ------------- | ---------- |
| Web App Standards     | ~550  | 12+    | 25+           | 3          |
| API Server Standards  | ~1100 | 15+    | 35+           | 4          |
| Electron Standards    | ~900  | 12+    | 25+           | 2          |
| Styles Guide (Korean) | ~310  | 8+     | 15+           | -          |

---

## 🔄 Version History

### v1.0.0 (2024-01)

- Initial release
- Web application standards (React + shadcn/ui + Tailwind)
- API server standards (Node.js + Express + MySQL)
- Electron application standards
- Comprehensive examples and patterns

---

## 🤝 Contributing

To improve these standards:

1. **Identify gaps**: Missing patterns, unclear examples
2. **Propose changes**: Submit PR with rationale
3. **Add examples**: Real-world code snippets
4. **Update versions**: When dependencies change

---

## 📞 Support

For questions or suggestions:

- Open an issue in the repository
- Contact the development team
- Submit a pull request with improvements

---

## 📄 License

These standards are maintained by the development team and are available for use in any project within the organization.

---

**Last Updated**: January 2024  
**Maintained By**: Development Team  
**Version**: 1.0.0
