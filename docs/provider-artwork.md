# Provider artwork provenance

The five still lifes were generated on November 7, 2026 with the built-in OpenAI imagegen tool. No source images were provided. The public provider sites establish where to find official photos or logos, but did not establish permission for CareConnect to reproduce them. All five assets use generated artwork, with no copied logo or facility image. The app labels each generated image “Illustration” and keeps the official tour or gallery links.

| Asset under `src/assets/provider-artwork` | Listing                    | Official site checked                                   | Generated prompt subject                                                                                                                                      |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `les-petits.jpg`                          | Les Petits                 | [Provider site](https://lespetitsprovo.com/)            | daycare category: a low shelf with a wooden shape sorter and stacking rings, folded small blanket, rounded blocks. Peach and sage palette.                    |
| `kids-village.jpg`                        | Kids Village               | [Provider site](https://kidsvillage.com/)               | preschool category: an open wordless picture book, a cup of chunky crayons, and colorful geometric puzzle shapes. Terracotta and golden-yellow palette.       |
| `guardian-angel.jpg`                      | Guardian Angel Babysitting | [Provider site](https://www.guardianangelbaby.com/utah) | in-home babysitting category: a soft teddy bear and a few blocks beside an open wordless bedtime picture book on a cozy rug. Lavender and warm cream palette. |
| `montessori.jpg`                          | Montessori Learning Center | [Provider site](https://montessoriutah.com/)            | Montessori preschool category: wooden graduated nesting cylinders, a small tray of wooden beads and a simple stacking tower. Soft olive and honey palette.    |
| `way-to-grow.jpg`                         | Way to Grow                | [Provider site](https://kidswaytogrow.com/)             | daycare category: colorful building blocks forming a little arch, a toy wooden pull train and a folded play mat. Muted teal and warm apricot palette.         |

Each prompt starts with “Generate one horizontal landscape 3:2 bitmap illustration for a childcare directory's provider card and profile header.” Append the corresponding subject above, followed by:

> Consistent collection style: warm, flat editorial gouache illustration, subtle paper grain, simple geometric shapes, soft shadows, saturated accents on a cream pastel background, centered still life. Arrange key objects in the central 55% of the image so it reads both cropped to a square thumbnail and cropped as a wide shallow banner. No people, faces, text, letters, numbers, logos, brands, marks, uniforms, signage, actual facility or exterior, or photorealism. This is generic representative artwork. Fill the canvas edge to edge.

The source PNGs were converted to 1,200 × 800 JPEGs for the app.
