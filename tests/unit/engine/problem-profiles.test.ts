import {it,expect} from 'vitest';
import {generatePlan,validatePlan} from '../../../src/engine';
import {hash} from '../../../src/engine/data';
import {engineProfileSchema} from '../../../src/engine/contracts';
import {sampledProfiles,TRAINING_ENGINE_SEED} from '../../../tools/eval/training-engine-profiles';
import fixed from '../../fixtures/training-engine/problem-profiles.json';
it('pins unchanged sampled inputs and provenance without supplying special generator branches',()=>{expect(fixed.source.sampleSeed).toBe(TRAINING_ENGINE_SEED);const sampled=sampledProfiles(fixed.source.sampledCount);for(const row of fixed.profiles){expect(row.profile).toEqual(sampled[row.index]);expect(hash([row.profile,fixed.source.variant])).toBe(row.profileHash);expect(engineProfileSchema.safeParse(row.profile).success).toBe(true);}expect(fixed.profiles).toHaveLength(new Set(fixed.source.reportedViolations.map(i=>i.index)).size);});
it.each(fixed.profiles)('fixed full-audit profile $index generates no floor-transition or duration hard violations',row=>{const profile=engineProfileSchema.parse(structuredClone(row.profile)),before=structuredClone(profile),plan=generatePlan(profile,{variant:fixed.source.variant});expect(plan.meta.seed).toBe(row.generationSeed);expect(plan.templates.length).toBeGreaterThan(0);expect(profile).toEqual(before);expect(validatePlan(plan,profile).filter(issue=>issue.severity==='error')).toEqual([]);});
