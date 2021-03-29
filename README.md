# Dodrio <a href="https://poloclub.github.io/dodrio/"><img align="right" src="public/figures/dodrio-logo.svg" height="38"></img></a>

An interactive visualization system designed to help NLP researchers and practitioners analyze and compare attention weights in transformer-based models with linguistic knowledge.

[![build](https://github.com/poloclub/dodrio/workflows/build/badge.svg)](https://github.com/poloclub/dodrio/actions)
[![arxiv badge](https://img.shields.io/badge/arXiv-2103.14625-red)](http://arxiv.org/abs/2103.14625)

<a href="https://youtu.be/uboTKqPNU5Y" target="_blank"><img src="https://i.imgur.com/h2x23o6.png" style="max-width:100%;"></a>

For more information, check out our manuscript:

[**Dodrio: Exploring Transformer Models with Interactive Visualization**](https://arxiv.org/abs/2103.14625).
Zijie J. Wang, Robert Turko, and Duen Horng Chau.
arXiv preprint 2021. arXiv:2103.14625.

## Live Demo

For a live demo, visit: http://poloclub.github.io/dodrio/

## Running Locally

Clone or download this repository:

```bash
git clone git@github.com:poloclub/dodrio.git

# use degit if you don't want to download commit histories
degit poloclub/dodrio
```

Install the dependencies:

```bash
npm install
```

Then run Dodrio:

```bash
npm run dev
```

Navigate to [localhost:5000](https://localhost:5000). You should see Dodrio running in your broswer :)

To see how we trained the Transformer or customize the visualization with a different model or dataset, visit the [`./data-generation/`](data-generation) directory.

## Credits

Dodrio was created by 
<a href="https://zijie.wang/">Jay Wang</a>,
<a href="https://www.linkedin.com/in/robert-turko/">Robert Turko</a>, and
<a href="https://www.cc.gatech.edu/~dchau/">Polo Chau</a>.

## Citation

```bibTeX
@misc{wang2021dodrio,
  title={Dodrio: Exploring Transformer Models with Interactive Visualization}, 
  author={Zijie J. Wang and Robert Turko and Duen Horng Chau},
  year={2021},
  eprint={2103.14625},
  archivePrefix={arXiv},
  primaryClass={cs.CL}
}
```

## License

The software is available under the [MIT License](https://github.com/poloclub/dodrio/blob/master/LICENSE).

## Contact

If you have any questions, feel free to [open an issue](https://github.com/poloclub/dodrio/issues/new/choose) or contact [Jay Wang](https://zijie.wang).
