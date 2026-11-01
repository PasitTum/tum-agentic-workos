# 🌿 Git Flow & Branching Standard
1. **Branching Strategy:**
   - `main`: Production release
   - `develop`: Staging / integration
   - `feature/<ISSUE-KEY>-<description>`: Feature development branches
   - `bugfix/<ISSUE-KEY>-<description>`: Defect fixes
2. **Commit Convention:**
   - Conventional Commits: `feat(...)`, `fix(...)`, `docs(...)`, `test(...)`, `refactor(...)`
3. **Pull Requests:**
   - Require automated CI passing + review approval before merging into `develop`.
