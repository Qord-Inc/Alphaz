# Chat Prompts Architecture

This folder contains the AI prompt logic for both organization and personal accounts.

## Files

### `organizationPrompts.ts`
System prompts for organization accounts (when `organizationId` is provided).

**Function**: `buildOrganizationSystemPrompt(contextData, intent): string`

**Context Data**:
- `summary`: Organization summary
- `demographicData`: Audience demographics
- `recentPosts`: Recent LinkedIn posts
- `engagementPatterns`: What content resonates

**Intents**:
- `draft`: Create new LinkedIn posts for the organization
- `edit`: Refine existing organization posts
- `ideate`: Generate 5 content ideas aligned with org brand
- `feedback`: Review posts for clarity and brand alignment

### `personalPrompts.ts`
System prompts for personal accounts (when no `organizationId`).

**Function**: `buildPersonalSystemPrompt(contextData, intent): string`

**Context Data**:
- `userProfileSummary`: Full persona from interview
  - `professional_background`
  - `core_values`
  - `communication_style`
  - `content_themes`
  - `personality_traits`
  - `goals_and_impact`
  - `raw_summary`

**Intents**:
- `draft`: Create personal LinkedIn posts in user's authentic voice
- `edit`: Refine posts while preserving personal voice
- `ideate`: Generate 5 ideas based on unique expertise and experiences
- `feedback`: Review for authenticity and personal brand alignment

## Usage

The chat route (`/api/chat/route.ts`) automatically selects the appropriate prompt builder:

```typescript
const systemPrompt = isOrganizationAccount
  ? buildOrganizationSystemPrompt(contextData, intent)
  : buildPersonalSystemPrompt(contextData, intent);
```

**Decision Logic**:
- If `organizationId` is present → Use organization prompts
- If no `organizationId` → Use personal prompts

## Key Differences

| Aspect | Organization | Personal |
|--------|-------------|----------|
| **Focus** | Brand voice, audience engagement, organization positioning | Personal brand, authentic voice, individual expertise |
| **Context** | Analytics, demographics, past posts, engagement patterns | Interview data, persona, values, communication style |
| **Tone** | Professional, data-driven, audience-aware | Authentic, personal, experience-based |
| **Goals** | Generate viral content for organization growth | Help individual build thought leadership |

## Anti-AI Rules

Both prompt sets enforce strict anti-AI patterns:
- ❌ No em dashes (—)
- ❌ No symmetrical sentence structures
- ❌ No generic openers ("Here's the thing", "Let's talk about")
- ❌ No listicles disguised as paragraphs
- ❌ No overly polished language
- ❌ No formulaic hooks
- ✅ Prefer natural rhythm and varied sentence lengths
- ✅ Direct statements mixed with reflection
- ✅ Plain language over clever phrasing

## Future Extensions

To add new intents:
1. Add to `IntentSchema` in `route.ts`
2. Add intent logic in both `organizationPrompts.ts` and `personalPrompts.ts`
3. Update this README with the new intent description

To add new context fields:
1. Update the appropriate interface (`OrganizationContextData` or `PersonalContextData`)
2. Add context injection logic in the prompt builder
3. Ensure the calling code provides the new context
