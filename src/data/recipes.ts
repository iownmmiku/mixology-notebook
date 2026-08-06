import type { Recipe } from '../types';
import { ibaSeeds } from './iba';
import { extraSeeds } from './extras';
import { mocktailSeeds } from './mocktails';
import { signatureSeeds } from './signature';
import { make } from './shared';

const allSeeds = [...ibaSeeds, ...extraSeeds, ...mocktailSeeds, ...signatureSeeds];

export const builtInRecipes: Recipe[] = allSeeds.map(make);

export const commonPantry = [
  '金酒', '伏特加', '白朗姆酒', '金色朗姆酒', '深色朗姆酒', '陈年朗姆酒', '牙买加朗姆酒', '波本威士忌',
  '黑麦威士忌', '苏格兰威士忌', '爱尔兰威士忌', '银龙舌兰', '麦斯卡', '干邑', '苹果白兰地', '皮斯科',
  '卡莎萨', '甜味美思', '干味美思', '金巴利', '阿佩罗', '君度橙酒', '咖啡利口酒', '杏仁利口酒',
  '樱桃利口酒', '黑加仑利口酒', '蓝柑橘利口酒', '绿薄荷利口酒', '白可可利口酒', '加利亚诺',
  '本笃会', '绿色查特酒', '黄查特酒', '圣日耳曼', '费尔南布兰卡苦酒', '阿玛罗', '老汤姆金酒',
  '普罗塞克起泡酒', '香槟', '苦艾酒', '苏打水', '汤力水', '可乐', '姜汁啤酒', '干白葡萄酒',
  '鲜榨柠檬汁', '鲜榨青柠汁', '橙汁', '西柚汁', '菠萝汁', '蔓越莓汁', '番茄汁', '苹果汁', '葡萄汁',
  '糖浆', '蜂蜜糖浆', '石榴糖浆', '姜糖浆', '杏仁糖浆', '龙舌兰糖浆', '蛋清', '蛋黄', '淡奶油', '椰浆',
  '薄荷叶', '罗勒叶', '安格仕苦精', '佩肖苦精', '橙味苦精', '伍斯特酱', '辣椒酱', '盐', '黑胡椒',
  '蜂蜜', '丁香', '黄瓜', '西瓜', '香蕉', '草莓', '芒果', '百香果',
];
