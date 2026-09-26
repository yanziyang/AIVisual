# What Is a Transformer?

## 00:00:00 — What Is a Transformer?

A Transformer is a neural network architecture that turns a sequence into useful representations by letting its pieces exchange information.

Today, we will follow one tiny message through the machine, and calculate attention ourselves. You only need multiplication, addition, and a little curiosity.

## 00:00:19 — One word. Two worlds.

Consider the word bank. In the river bank, it means the land beside water. In the bank approved my loan, it means a financial institution.

The spelling stays the same. The surrounding words change the meaning. A Transformer builds a different representation of bank in each context.

## 00:00:39 — First, text becomes tokens

A tokenizer splits text into pieces called tokens. A token can be a word, part of a word, or punctuation. The exact split depends on the tokenizer.

Each token gets an integer ID. That ID looks up a learned vector: a list of numbers called an embedding. Our drawings use a few numbers; real models use many more.

## 00:01:03 — A vector is a numerical description

Imagine an embedding as a location in a high dimensional space. Training adjusts these locations so the network can use them to make predictions.

Do not read one coordinate as a neat label like river or money. Useful information is usually spread across many coordinates and interactions.

## 00:01:22 — Order needs a signal

Self attention without position information treats a reordered input as the same collection, with its outputs reordered too. It needs a signal about sequence order.

The original Transformer adds positional vectors to embeddings, using sine and cosine waves at different frequencies. Other designs encode position differently. For our tour, token vector plus position vector gives the starting representation.

## 00:01:49 — Let tokens exchange information

In self attention, every position makes a request and compares it with information offered by other positions in the same sequence.

The result is a weighted blend of information. A token can gather useful context from a distant token directly, instead of passing everything along one neighbor at a time.

## 00:02:07 — Three roles: Q, K, V

Each input vector is transformed into three vectors. The query is what this position is looking for. A key is what another position can be matched by. A value is the information it can contribute.

These are helpful analogies, not literal questions written in English. The vectors come from learned matrix multiplications: Q equals X times W Q, and similarly for K and V.

## 00:02:34 — Learned matrices do the work

A matrix multiplication forms new coordinates by weighted sums of the old ones. Here, the input one, two becomes the query one, zero with this example matrix.

Training learns the entries of those projection matrices. The input changes from sentence to sentence; the learned matrices stay fixed during ordinary generation. Different layers and attention heads have their own projections.

## 00:03:01 — A tiny, complete experiment

Now forget the words for a moment and use three synthetic candidates, A, B, and C. Our query is one, zero. The keys are two, zero; zero, two; and one, one.

We also give each candidate a value vector. These invented numbers are chosen for easy arithmetic. They are not measurements from a trained language model.

## 00:03:26 — 1. Compare with a dot product

For A, multiply one times two and zero times zero, then add. The score is two. For B, the score is zero. For C, it is one.

A larger query key dot product means greater compatibility in the learned representation. It is not automatically a probability, and it depends on vector lengths as well as direction.

## 00:03:50 — 2. Scale the scores

Our keys have two coordinates, so d k is two. Divide every score by the square root of two. We get approximately one point four one four, zero, and zero point seven zero seven.

Why scale? With many roughly independent, zero mean, unit variance coordinates, dot product variance grows with dimension. Scaling helps prevent softmax from becoming excessively sharp and making learning difficult.

## 00:04:19 — 3. Softmax makes a recipe

Softmax exponentiates each score and divides by the sum of those exponentials. For A, e to the power one point four one four is about four point one one three.

The three exponentials total about seven point one four one. Our weights are roughly fifty seven point six percent, fourteen percent, and twenty eight point four percent. Every query gets its own recipe.

## 00:04:43 — 4. Blend the values

Multiply each value vector by its attention weight, then add the results coordinate by coordinate. A contributes about one point one five two, zero. B contributes zero, zero point two eight zero.

C contributes zero point two eight four to each coordinate. The final output is approximately one point four three six, zero point five six four. It is a new vector, not a selected word.

## 00:05:12 — The whole mechanism in one line

Attention of Q, K, and V equals softmax of Q times K transpose, divided by the square root of d k, all multiplied by V.

Transpose turns keys into columns so matrix multiplication computes every query key comparison. Softmax runs separately across each row. Multiplying by V blends values for every query at once.

## 00:05:36 — Now scale up to a sequence

For n tokens, Q and K each have n rows and d k columns. Their product gives an n by n score grid. V has n rows and d v columns.

The final output has n rows and d v columns: one new vector per token. Attention weights describe information routing. They are not guaranteed explanations of why a model reached a conclusion.

## 00:06:00 — Multiple heads, different views

One attention head can make only one blend per position. Multiple heads use different learned projections, so they can gather different kinds of information in parallel.

Their outputs are concatenated, then mixed by another learned matrix. Heads can discover different patterns, but we do not assign each one a fixed job like grammar or meaning.

## 00:06:22 — Attention is part of a block

A Transformer block also contains a feed forward neural network. Attention mixes information across positions; this network transforms each position separately, using the same weights at every position.

A common form expands the vector, applies a nonlinear activation, then projects it back. Nonlinearity lets the network build more complex features than a single matrix multiplication can.

## 00:06:49 — Keep the old signal, add an update

Residual connections add a sublayer's update to its input. Instead of replacing the whole representation, each stage can refine it. This also helps gradients flow during training.

Layer normalization rescales a token's features and learns a scale and offset. The original Transformer normalizes after the residual addition; many variants normalize before the sublayer. Stack blocks to repeatedly refine context.

## 00:07:17 — A family of architectures

An encoder can let every input position see the full input. A decoder for next token generation uses a causal restriction. The original Transformer combines an encoder and a decoder for translation.

In that combination, cross attention uses decoder queries with encoder keys and values. Self attention uses one sequence for all three. The same basic attention machinery supports different information flows.

## 00:07:45 — No peeking at future tokens

To predict the next token after the cat, the decoder must not see that next token. A causal mask blocks attention to later input positions by setting their scores to negative infinity.

After softmax, blocked positions get zero weight. A position may still attend to itself and earlier positions. Training shifts the targets by one: each position predicts the following token.

## 00:08:11 — From a vector to a next token

The final representation at the last position is projected into one score, or logit, for every token in the vocabulary. Another softmax turns these scores into next token probabilities.

The system chooses a token, perhaps by sampling. It appends that token and repeats. These vocabulary probabilities are different from attention weights, which choose how to mix information inside the network.

## 00:08:38 — How does it learn those weights?

During next token training, the model receives text and predicts the following tokens. Cross entropy penalizes giving low probability to the observed next token: loss equals negative log of its probability.

If the correct token gets probability zero point two, the loss is about one point six zero nine. At zero point eight, it is about zero point two two three. Backpropagation computes gradients; an optimizer updates learned weights to reduce average loss.

## 00:09:09 — Parallel training. Sequential writing.

During training, all the correct input tokens are already available, so many positions can be processed in parallel, while a mask prevents cheating. During generation, each new token depends on the previous choices.

Full attention compares every pair of positions. Double the sequence length, and the number of pairs quadruples. Efficient implementations reduce memory costs, but long context still requires substantial computation.

## 00:09:39 — Follow the signal from start to finish

Here is the journey: tokenize, look up embeddings, add position information, then pass through blocks of attention and feed forward computation with residual connections and normalization.

For attention, remember four verbs: compare, scale, normalize, blend. Learned weights make the recipes useful. For generation, project the final vector to vocabulary probabilities, choose a token, and repeat.

## 00:10:08 — Your turn: change the query

One final puzzle. Keep our three keys and values, but change the query to zero, one. Which candidate gets the greatest attention weight? Pause and work out the dot products.

B now wins: the scores are zero, two, and one. The output flips to approximately zero point five six four, one point four three six. Attention is a context dependent recipe, recalculated from the current vectors. Try it yourself in the companion playground.

## 00:10:41 — A Transformer builds context

You have now computed the heart of a Transformer. It is a network that learns how to route and transform information, building representations that help it predict or solve a task.

Fluent predictions are not a guarantee of truth. But the mechanism is something you can understand: vectors, comparisons, weighted sums, and learned transformations, repeated at scale.

## Sources

- Vaswani et al., Attention Is All You Need (2017), sections 3–4: https://arxiv.org/abs/1706.03762
- Dive into Deep Learning, Attention Scoring Functions: https://d2l.ai/chapter_attention-mechanisms-and-transformers/attention-scoring-functions.html
- PyTorch, Scaled Dot Product Attention: https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html
- Dive into Deep Learning, Transformer: https://d2l.ai/chapter_attention-mechanisms-and-transformers/transformer.html
- Dive into Deep Learning, Language Models: https://d2l.ai/chapter_recurrent-neural-networks/language-model.html

All diagrams are original. Numerical examples and illustrative probabilities are synthetic. Narration uses the installed Windows speech voice.
