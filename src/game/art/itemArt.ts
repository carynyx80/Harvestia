// 16×16 inventory icons in the approved palette. Crops, animals, machines and
// buildings reuse the world sprites; these cover packaged and processed goods.
import HV from './sprites';
import type { CropType } from '../world/geometry';

const { R, P, E } = HV;
const SEED_TINT: Record<CropType, string> = {
  wheat: '#e8b93c', corn: '#f2c94c', soy: '#9cc24a', coffee: '#8a1f1f', cocoa: '#b8601f', tomato: '#e0402f', potato: '#c9a6e8', rice: '#a8d8e6',
};

export const ItemArt = {
  crop: (c: CropType) => () => HV.crop(c, 3, 8, 15),
  seeds: (c: CropType) => () => {
    R(3, 2, 10, 13, '#5a3420'); R(4, 3, 8, 11, '#e9dcb8'); R(4, 3, 8, 2, SEED_TINT[c]); R(4, 3, 8, 1, '#fff4d6');
    R(5, 6, 6, 6, '#f4ead0'); HV.crop(c, 1, 8, 11); R(4, 13, 8, 1, '#c9b48a');
    P(6, 4, '#3b2414'); P(9, 4, '#3b2414');
  },
  feed: (tint: string) => () => {
    E(8, 14, 6, 1, 'rgba(22,46,18,.3)');
    R(3, 5, 10, 9, '#d8c59a'); R(4, 4, 8, 1, '#d8c59a'); R(5, 3, 6, 1, '#b8a47a'); R(11, 5, 2, 9, '#bfae84');
    R(4, 8, 8, 3, tint); R(4, 8, 8, 1, '#ffffff55'); P(6, 6, '#e8b93c'); P(9, 6, '#e8b93c'); P(7, 5, '#e8b93c');
  },
  egg: () => { E(8, 14, 5, 1, 'rgba(22,46,18,.3)'); E(6, 10, 3, 4, '#f4ead8'); E(10, 10, 3, 4, '#e8d6b4'); P(5, 8, '#ffffff'); P(9, 8, '#fff6e6'); R(3, 12, 10, 2, '#b07a44'); R(3, 12, 10, 1, '#c48d52'); },
  milk: () => { E(8, 15, 4, 1, 'rgba(22,46,18,.3)'); R(5, 5, 6, 10, '#f7f4ee'); R(6, 3, 4, 2, '#f7f4ee'); R(6, 2, 4, 1, '#3f6fa8'); R(5, 8, 6, 3, '#3f6fa8'); R(6, 9, 4, 1, '#ffffff'); R(10, 5, 1, 10, '#d6d0c4'); },
  wool: () => { E(8, 14, 6, 1, 'rgba(22,46,18,.3)'); E(8, 9, 6, 5, '#f4efe2'); E(5, 8, 3, 3, '#ffffff'); E(11, 10, 3, 3, '#e2dac8'); P(7, 7, '#d9d0bd'); P(10, 9, '#d9d0bd'); R(7, 12, 6, 1, '#c4553b'); },
  truffle: () => { E(8, 14, 5, 1, 'rgba(22,46,18,.3)'); E(8, 10, 5, 4, '#5a3a26'); E(7, 9, 3, 2, '#7a4e2c'); P(6, 8, '#9a6a3c'); P(10, 11, '#3a2414'); P(5, 11, '#3a2414'); },
  flour: () => { HV.sack(8, 15); R(6, 10, 4, 2, '#e8b93c'); },
  cheese: () => { E(8, 14, 6, 1, 'rgba(22,46,18,.3)'); for (let r = 0; r < 7; r++) R(3 + r, 6 + r, 11 - r, 1, '#f2c94c'); R(3, 13, 11, 1, '#c99a2e'); P(9, 9, '#c99a2e'); P(11, 11, '#c99a2e'); R(3, 6, 1, 8, '#e8b93c'); },
  butter: () => { E(8, 14, 6, 1, 'rgba(22,46,18,.3)'); R(3, 8, 10, 5, '#f7e08a'); R(3, 8, 10, 1, '#fff4c0'); R(3, 12, 10, 1, '#d9b84a'); R(2, 13, 12, 1, '#c9ced6'); },
  chocolate: () => { E(8, 14, 6, 1, 'rgba(22,46,18,.3)'); R(3, 4, 10, 10, '#5a3420'); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { R(4 + i * 3, 5 + j * 3, 2, 2, '#7a4a28'); P(4 + i * 3, 5 + j * 3, '#9a6436'); } R(3, 11, 10, 3, '#c4553b'); R(3, 11, 10, 1, '#e47b57'); },
  coffeeBag: () => { E(8, 15, 5, 1, 'rgba(22,46,18,.3)'); R(4, 4, 8, 11, '#8a5530'); R(5, 3, 6, 1, '#6e4527'); R(5, 7, 6, 4, '#f4e4bc'); E(8, 9, 1, 1, '#5a3420'); P(8, 9, '#8a1f1f'); R(11, 4, 1, 11, '#6e4527'); },
  sauce: () => { E(8, 15, 4, 1, 'rgba(22,46,18,.3)'); R(5, 6, 6, 9, '#e0402f'); R(5, 4, 6, 2, '#5e6670'); R(6, 9, 4, 3, '#f4e4bc'); P(7, 10, '#3f8f3a'); R(5, 6, 1, 9, '#ff8a6a'); },
  can: () => { E(8, 15, 6, 1, 'rgba(22,46,18,.3)'); R(3, 6, 8, 8, '#8c93a0'); R(3, 6, 8, 2, '#dfe4ea'); R(11, 7, 3, 1, '#8c93a0'); R(13, 5, 1, 2, '#8c93a0'); R(5, 3, 4, 1, '#5e6670'); R(4, 4, 1, 2, '#5e6670'); R(9, 4, 1, 2, '#5e6670'); P(14, 4, '#86ccf2'); P(15, 6, '#86ccf2'); },
};
