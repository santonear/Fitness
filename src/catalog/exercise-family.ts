import {catalogMetadata} from './registry';
import type {exercises} from './exercises';
type Exercise=typeof exercises[number];
const equipmentWords=/\b(?:single|double|one|two|dual|pair|dumbbells?|barbells?|kettlebells?|bodyweight|machine|cable|band|resistance|weighted)\b/g;
function familySlug(exercise:Exercise){return (catalogMetadata.get(exercise.id)?.slug??exercise.name.en).toLowerCase().replace(/[-_]/g,' ').replace(equipmentWords,'').replace(/[^a-z0-9]/g,'');}
function familyName(exercise:Exercise){return exercise.name.zh.replace(/^(?:(?:单|双|一对|双手|单手)?(?:哑铃|杠铃|壶铃|徒手|器械|弹力带)|单|双)+/,'').replace(/[\s·-]/g,'');}
export function sameExerciseFamily(a:Exercise,b:Exercise){return a.id===b.id||familySlug(a)===familySlug(b)||familyName(a)===familyName(b);}
